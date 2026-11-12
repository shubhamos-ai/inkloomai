"""Brand-rule extraction parsing and provider wiring tests."""
from __future__ import annotations

from app.config import settings
from app.engine import extraction_engine
from app.services import extraction_service, nim_vision_service


SOURCE = (
    "Brand colours must be Warm Ivory #F8F5EF and Sage Green #A8B5A0. "
    "No neon colours are allowed. The logo must never be rotated."
)


def test_parse_model_output_accepts_plain_json():
    raw = '{"rules":[{"category":"logo","requirement":"Never rotate the logo","severity":"major","source_text":"The logo must never be rotated.","confidence":0.9}]}'
    parsed = extraction_engine.parse_model_output(raw)
    assert isinstance(parsed, dict)
    assert len(parsed["rules"]) == 1


def test_parse_model_output_accepts_fenced_json():
    raw = '```json\n{"rules":[]}\n```'
    assert extraction_engine.parse_model_output(raw) == {"rules": []}


def test_parse_model_output_salvages_truncated_rules_array():
    # Provider stopped at max_tokens: the second object is cut mid-string.
    raw = (
        '{"rules":['
        '{"category":"colour_palette","requirement":"Use Warm Ivory",'
        '"severity":"major","source_text":"Warm Ivory #F8F5EF","confidence":0.9},'
        '{"category":"restricted_content","requirement":"No neon colours",'
        '"severity":"critical","source_text":"No neon colours are allowed.'
    )
    parsed = extraction_engine.parse_model_output(raw)
    assert isinstance(parsed, dict)
    assert len(parsed["rules"]) == 1
    assert parsed["rules"][0]["requirement"] == "Use Warm Ivory"


def test_parse_model_output_salvage_handles_braces_in_strings():
    raw = (
        '{"rules":['
        '{"category":"messaging","requirement":"Keep {braces} literal",'
        '"severity":"minor","source_text":"Keep {braces} literal","confidence":0.8},'
        '{"category":"general","requirement":"cut'
    )
    parsed = extraction_engine.parse_model_output(raw)
    assert len(parsed["rules"]) == 1
    assert parsed["rules"][0]["requirement"] == "Keep {braces} literal"


def test_parse_model_output_rejects_garbage():
    try:
        extraction_engine.parse_model_output("not json at all")
    except ValueError:
        pass
    else:  # pragma: no cover
        raise AssertionError("garbage should not parse")


def test_validate_proposals_enforces_verbatim_quote():
    raw = {
        "rules": [
            {
                "category": "colour_palette",
                "requirement": "Use Warm Ivory and Sage Green",
                "severity": "major",
                "source_text": "Warm Ivory #F8F5EF and Sage Green #A8B5A0",
                "confidence": 0.9,
            },
            {
                "category": "logo",
                "requirement": "Never rotate the logo",
                "severity": "major",
                "source_text": "This sentence is not in the document.",
                "confidence": 0.9,
            },
        ]
    }
    proposals, rejected, _warnings = extraction_engine.validate_proposals(raw, SOURCE)
    assert len(proposals) == 1
    assert proposals[0]["category"] == "colour_palette"
    assert len(rejected) == 1
    assert "verbatim" in rejected[0]["reason"]


def test_call_model_uses_extraction_budget_and_disables_thinking(monkeypatch):
    captured: dict = {}

    def fake_generate(**kwargs):
        captured.update(kwargs)
        return '{"rules":[]}'

    monkeypatch.setattr(settings, "EXTRACTION_PROVIDER", "nvidia_nim")
    monkeypatch.setattr(settings, "EXTRACTION_MODEL", "nvidia/nemotron-3.5-lightning-30b-a3b")
    monkeypatch.setattr(settings, "EXTRACTION_MAX_TOKENS", 8192)
    monkeypatch.setattr(settings, "EXTRACTION_TIMEOUT_SECONDS", 180.0)
    monkeypatch.setattr(nim_vision_service, "generate", fake_generate)

    text, model = extraction_service._call_model(SOURCE)

    assert text == '{"rules":[]}'
    assert model == "nvidia/nemotron-3.5-lightning-30b-a3b"
    assert captured["max_tokens"] == 8192
    assert captured["timeout"] == 180.0
    assert captured["extra_payload"] == {
        "temperature": 0.0,
        "chat_template_kwargs": {"enable_thinking": False},
    }


def test_call_model_leaves_thinking_alone_for_plain_models(monkeypatch):
    captured: dict = {}

    def fake_generate(**kwargs):
        captured.update(kwargs)
        return '{"rules":[]}'

    monkeypatch.setattr(settings, "EXTRACTION_PROVIDER", "nvidia_nim")
    monkeypatch.setattr(settings, "EXTRACTION_MODEL", "mistralai/mistral-large")
    monkeypatch.setattr(nim_vision_service, "generate", fake_generate)

    extraction_service._call_model(SOURCE)
    assert captured["extra_payload"] == {"temperature": 0.0}


def test_quote_matches_tolerates_wrapping_quotes_and_trailing_period():
    source = '- "Clear Acne Permanently."\n- "100% Guaranteed Results."'
    assert extraction_engine._quote_matches('"Clear Acne Permanently"', extraction_engine._norm(source))
    assert extraction_engine._quote_matches("Clear Acne Permanently", extraction_engine._norm(source))
    assert not extraction_engine._quote_matches("Cures every skin disease", extraction_engine._norm(source))


def test_validate_proposals_caps_each_category(monkeypatch):
    monkeypatch.setattr(settings, "EXTRACTION_MAX_RULES_PER_CATEGORY", 2)
    raw = {
        "rules": [
            {"category": "restricted_content", "requirement": f"Rule number {i}", "severity": "major",
             "source_text": "No neon colours are allowed.", "confidence": 0.8}
            for i in range(5)
        ]
    }
    proposals, _rejected, warnings = extraction_engine.validate_proposals(raw, SOURCE)
    assert len(proposals) == 2
    assert any("per-category limit" in w for w in warnings)


CANNED_OUTPUT = (
    '{"rules":['
    '{"category":"logo","requirement":"Never rotate the logo","severity":"major",'
    '"source_text":"The logo must never be rotated.","confidence":0.9},'
    '{"category":"colour_palette","requirement":"Use Warm Ivory","severity":"minor",'
    '"source_text":"Warm Ivory #F8F5EF","confidence":0.8}]}'
)


def test_extract_review_and_commit_flow(client, company_a, monkeypatch):
    from tests.conftest import headers_key

    token = company_a["token"]
    intake = client.post(
        "/api/v1/brand-brain",
        data={"rules_text": SOURCE},
        headers=headers_key(token),
    )
    assert intake.status_code == 200, intake.text

    monkeypatch.setattr(
        extraction_service,
        "_call_model",
        lambda _source: (CANNED_OUTPUT, "test-model"),
    )

    extracted = client.post("/api/v1/brand-brain/extract", headers=headers_key(token))
    assert extracted.status_code == 200, extracted.text
    run = extracted.json()["run"]
    assert run["status"] == "completed"
    assert len(run["proposed_rules"]) == 2

    committed = client.post(
        f"/api/v1/brand-brain/extract/{run['id']}/commit",
        json={"rules": run["proposed_rules"]},
        headers=headers_key(token),
    )
    assert committed.status_code == 200, committed.text
    assert committed.json()["committed_count"] == 2

    rules = client.get("/api/v1/brand-brain/rules", headers=headers_key(token)).json()
    assert rules["count"] == 2

    rule_id = rules["rules"][0]["id"]
    versions = client.get(
        f"/api/v1/brand-brain/rules/{rule_id}/versions", headers=headers_key(token)
    ).json()
    assert len(versions["versions"]) >= 1


def test_brand_rule_source_type_fits_extraction_provenance():
    from app.models import BrandRule

    # `ai_extraction:<uuid>` is 50 chars; the column must fit the ORM's 80.
    assert BrandRule.__table__.c.source_type.type.length >= 80
