"""Brand Brain intake, retrieval and rule management tests."""
from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from tests.conftest import headers_key


def test_rules_endpoints_require_auth(client: TestClient):
    assert client.get("/api/v1/brand-brain/rules").status_code == 401
    assert client.get("/api/v1/brand-brain").status_code == 401


def test_intake_with_rules_text(client: TestClient, company_a: dict):
    resp = client.post(
        "/api/v1/brand-brain",
        data={"rules_text": "Our logo is always navy blue. Never rotate the logo."},
        headers=headers_key(company_a["token"]),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["rule_count"] == 0  # structuring comes later; nothing invented
    assert "Our logo is always navy blue." in body["original_rules_text"]
    assert body["version"] >= 1


def test_intake_with_txt_file_and_text(client: TestClient, company_a: dict):
    resp = client.post(
        "/api/v1/brand-brain",
        data={"rules_text": "Second intake text."},
        files={"files": ("guidelines.txt", b"FONT: always Inter. HEADLINE: sentence case.", "text/plain")},
        headers=headers_key(company_a["token"]),
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["file_count"] >= 1
    assert "always Inter." in body["original_rules_text"]


def test_intake_rejects_non_document_bytes(client: TestClient, company_a: dict):
    resp = client.post(
        "/api/v1/brand-brain",
        files={"files": ("rules.pdf", b"\x89PNG-not-actually-a-pdf", "application/pdf")},
        headers=headers_key(company_a["token"]),
    )
    assert resp.status_code == 422


def test_get_brand_brain(client: TestClient, company_a: dict):
    resp = client.get("/api/v1/brand-brain", headers=headers_key(company_a["token"]))
    assert resp.status_code == 200
    body = resp.json()
    assert str(body["company_id"]) == company_a["company_id"]


def test_manual_rule_crud_and_source_preserved(client: TestClient, company_a: dict):
    token = company_a["token"]
    req = {
        "category": "logo",
        "requirement": "Logo must be top-left.",
        "severity": "critical",
        "source_text": "We always keep the logo top-left on every poster.",
    }
    resp = client.post("/api/v1/brand-brain/rules", json=req, headers=headers_key(token))
    assert resp.status_code == 200
    rule = resp.json()
    assert rule["code"].startswith("BR")
    assert rule["source_type"] == "manual"
    assert rule["source_text"] == req["source_text"]

    # Update severity/category/disabled — source_text untouched.
    rule_id = rule["id"]
    resp = client.put(
        "/api/v1/brand-brain/rules",
        json={"rule_id": rule_id, "enabled": False, "category": "placement"},
        headers=headers_key(token),
    )
    assert resp.status_code == 200
    updated = resp.json()
    assert updated["enabled"] is False
    assert updated["category"] == "placement"
    assert updated["source_text"] == req["source_text"]


def test_rule_update_requires_rule_id(client: TestClient, company_a: dict):
    resp = client.put(
        "/api/v1/brand-brain/rules", json={"enabled": True}, headers=headers_key(company_a["token"])
    )
    assert resp.status_code == 422


def test_rules_listing_ordered(client: TestClient, company_a: dict):
    from tests.conftest import add_rules

    add_rules(client, company_a["token"])
    resp = client.get("/api/v1/brand-brain/rules", headers=headers_key(company_a["token"]))
    assert resp.status_code == 200
    body = resp.json()
    codes = [r["code"] for r in body["rules"]]
    assert codes == sorted(codes)
    assert body["count"] == len(codes)
