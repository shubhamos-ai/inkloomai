"""Regression tests for large-rulebook compliance audits.

A real production run with 58 committed rules overflowed the provider's
completion budget, returned truncated JSON, and retried forever. These tests
lock in batching, truncation salvage and per-batch degradation.
"""
from __future__ import annotations

import json
import re

import pytest

from app.config import settings
from app.services import analysis_service, nim_vision_service, ollama_service
from app.services.json_utils import salvage_partial_json


@pytest.fixture(autouse=True)
def _use_ollama_provider(monkeypatch):
    """Never hit the network: the developer .env may hold a real NIM key."""
    monkeypatch.setattr(settings, "VISION_PROVIDER", "ollama")
    monkeypatch.setattr(settings, "OLLAMA_VISION_MODEL", "test-vision-model")


def _rule(index: int) -> dict:
    return {
        "id": f"00000000-0000-0000-0000-{index:012d}",
        "code": f"BR{index:03d}",
        "category": "general",
        "requirement": f"Requirement number {index}",
        "severity": "major",
    }


def test_salvage_recovers_complete_objects_from_truncated_json():
    raw = (
        '{"summary": "Mostly compliant", "checks": ['
        '{"rule_id": "BR001", "state": "passed", "detail": "ok"},'
        '{"rule_id": "BR002", "state": "failed", "detail": "bad"},'
        '{"rule_id": "BR003", "state": "inc'
    )
    salvaged = salvage_partial_json(raw)
    assert salvaged is not None
    assert salvaged["summary"] == "Mostly compliant"
    assert [c["rule_id"] for c in salvaged["checks"]] == ["BR001", "BR002"]


def test_salvage_recovers_violations_and_recommendations():
    raw = (
        '{"checks": [], "violations": ['
        '{"rule_id": "BR002", "title": "Unsupported claim", "explanation": "Cures acne",'
        ' "evidence": "CURES ACNE IN 3 DAYS", "confidence": 0.9}'
        '], "recommendations": ["Remove the cure claim", "Add a disclaimer"]}'
    )
    salvaged = salvage_partial_json(raw)
    assert salvaged is not None
    assert len(salvaged["violations"]) == 1
    assert salvaged["recommendations"] == ["Remove the cure claim", "Add a disclaimer"]


def test_parse_json_loose_uses_salvage_for_truncated_output():
    raw = (
        '{"summary": "partial", "checks": ['
        '{"rule_id": "BR001", "state": "passed"}'
    )
    parsed = nim_vision_service.parse_json_loose(raw)
    assert parsed["summary"] == "partial"
    assert parsed["checks"][0]["rule_id"] == "BR001"


def _install_fake_provider(monkeypatch, *, fail_first_batch: bool = False):
    """Return a fake generate() that answers for the rules in each prompt."""
    calls: list[int] = []

    def fake_generate(*, prompt: str, system: str | None = None, **kwargs) -> str:
        codes = re.findall(r'"rule_id":\s*"(BR\d+)"', prompt)
        calls.append(len(codes))
        if fail_first_batch and len(calls) == 1:
            raise ValueError("simulated truncated output")
        checks = [
            {
                "rule_id": code,
                "category": "general",
                "state": "passed",
                "detail": "looks compliant",
                "confidence": 0.9,
            }
            for code in codes
        ]
        return json.dumps(
            {
                "summary": f"batch {len(calls)} reviewed",
                "checks": checks,
                "violations": [],
                "recommendations": ["Keep the layout"],
            }
        )

    monkeypatch.setattr(ollama_service, "generate", fake_generate)
    monkeypatch.setattr(
        ollama_service, "parse_json_loose", nim_vision_service.parse_json_loose
    )
    return calls


def test_large_rulebook_is_batched_and_fully_evaluated(monkeypatch):
    calls = _install_fake_provider(monkeypatch)
    rules = [_rule(i) for i in range(1, 46)]  # 45 rules -> 20 + 20 + 5

    report = analysis_service._ai_compliance_report(
        analysis_id="analysis-1",
        rules=rules,
        vision={"observations": []},
        ocr_text="",
    )

    assert calls == [20, 20, 5]
    assert report["analysis_metadata"]["compliance_batches"] == 3
    assert report["analysis_metadata"]["compliance_failed_batches"] == 0
    assert len(report["passed_checks"]) == 45
    assert len(report["recommendations"]) == 1  # merged, de-duplicated


def test_failed_batch_degrades_to_inconclusive_not_whole_audit(monkeypatch):
    _install_fake_provider(monkeypatch, fail_first_batch=True)
    rules = [_rule(i) for i in range(1, 46)]

    report = analysis_service._ai_compliance_report(
        analysis_id="analysis-2",
        rules=rules,
        vision={"observations": []},
        ocr_text="",
    )

    assert report["analysis_metadata"]["compliance_failed_batches"] == 1
    assert len(report["passed_checks"]) == 25
    assert len(report["inconclusive_checks"]) == 20


def test_provider_outage_remains_retryable(monkeypatch):
    def boom(*args, **kwargs):
        raise RuntimeError("provider unavailable")

    monkeypatch.setattr(ollama_service, "generate", boom)

    with pytest.raises(analysis_service.ProviderUnavailable):
        analysis_service._ai_compliance_report(
            analysis_id="analysis-3",
            rules=[_rule(1)],
            vision={"observations": []},
            ocr_text="",
        )


def test_heartbeat_reports_batch_progress(monkeypatch):
    _install_fake_provider(monkeypatch)
    seen: list[tuple[int, int]] = []

    analysis_service._ai_compliance_report(
        analysis_id="analysis-4",
        rules=[_rule(i) for i in range(1, 46)],
        vision={"observations": []},
        ocr_text="",
        heartbeat=lambda done, total: seen.append((done, total)),
    )

    assert seen == [(0, 3), (1, 3), (1, 3), (2, 3), (2, 3), (3, 3)]
