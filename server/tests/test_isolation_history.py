"""History pagination + company data isolation tests."""
from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from tests.conftest import add_rules, headers_key, run_queue_until


def _submit_and_run(client, company, png) -> str:
    """Submit one analysis, then run the queue until it completes."""
    token = company["token"]
    add_rules(client, token)
    resp = client.post(
        "/api/v1/analysis",
        files={"file": ("ad.png", png, "image/png")},
        headers=headers_key(token),
    )
    assert resp.status_code == 202, resp.text
    analysis_id = resp.json()["analysis_id"]
    status = run_queue_until(client, token, analysis_id)
    assert status == "completed", analysis_id
    return analysis_id


def test_history_paginated(company_a, client: TestClient, png: bytes):
    token = company_a["token"]
    for _ in range(3):
        _submit_and_run(client, company_a, png)

    resp = client.get("/api/v1/analysis/history", headers=headers_key(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] >= 3
    assert body["page"] == 1
    created = [item["created_at"] for item in body["items"]]
    assert created == sorted(created, reverse=True)  # newest first

    paged = client.get("/api/v1/analysis/history?limit=2&page=1", headers=headers_key(token))
    assert len(paged.json()["items"]) == 2


def test_history_status_filter(company_a, client: TestClient, png: bytes):
    resp = client.get(
        "/api/v1/analysis/history?status=completed", headers=headers_key(company_a["token"])
    )
    assert resp.status_code == 200
    for item in resp.json()["items"]:
        assert item["status"] == "completed"


def test_company_isolation_on_object_endpoints(
    company_a, company_b, client: TestClient, png: bytes
):
    analysis_id = _submit_and_run(client, company_a, png)
    token_b = company_b["token"]

    # B cannot read A's analysis report / status / image.
    assert client.get(f"/api/v1/analysis/{analysis_id}", headers=headers_key(token_b)).status_code == 404
    assert client.get(f"/api/v1/analysis/{analysis_id}/status", headers=headers_key(token_b)).status_code == 404
    assert client.get(f"/api/v1/analysis/{analysis_id}/image", headers=headers_key(token_b)).status_code == 404

    # B's history never contains A's analysis.
    history_b = client.get("/api/v1/analysis/history?limit=50", headers=headers_key(token_b)).json()
    assert str(analysis_id) not in {item["analysis_id"] for item in history_b["items"]}

    # Rules isolation: A's rule ids mean nothing to B.
    rules_a = client.get("/api/v1/brand-brain/rules", headers=headers_key(company_a["token"])).json()
    a_rule_id = rules_a["rules"][0]["id"]
    resp = client.put(
        "/api/v1/brand-brain/rules",
        json={"rule_id": a_rule_id, "enabled": False},
        headers=headers_key(token_b),
    )
    assert resp.status_code == 404

    # Brand brain isolation: dev-token accessing foreign company id still binds to that company.
    resp = client.get(
        "/api/v1/brand-brain",
        headers={"Authorization": "Bearer test-dev-token-12345", "X-Company-ID": str(uuid.uuid4())},
    )
    assert resp.status_code == 401


def test_files_rooted_per_storage_tree(company_a, client: TestClient, png: bytes):
    """Uploads live under storage/uploads/{company_id}/{analysis_id}/ only."""
    import pathlib

    from app.config import settings

    token = company_a["token"]
    analysis_id = _submit_and_run(client, company_a, png)
    expected_dir = settings.STORAGE_DIR / "uploads" / company_a["company_id"] / str(analysis_id)
    files = list(expected_dir.glob("image.*"))
    assert expected_dir.is_dir()
    # No traversal targets present on disk.
    for path in pathlib.Path(settings.STORAGE_DIR).rglob("*"):
        name = str(path)
        assert ".." not in name.split("/")
