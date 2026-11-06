"""Onboarding + authentication tests."""
from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from tests.conftest import headers_company, headers_key


def test_onboarding_creates_user_and_company(client: TestClient):
    resp = client.post(
        "/api/v1/onboarding",
        json={
            "name": "Ada Lovelace",
            "company_name": "Analytical Engines",
            "industry": "Technology",
            "website": "https://analytical.example",
            "email": f"ada-{uuid.uuid4().hex[:6]}@example.com",
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["user_id"] and body["company_id"]
    assert body["access_token"].startswith("ik_dev_")
    assert body["token_type"] == "bearer"


def test_onboarding_requires_fields(client: TestClient):
    resp = client.post("/api/v1/onboarding", json={"name": "", "company_name": ""})
    assert resp.status_code == 422


def test_bad_token_is_401(client: TestClient):
    resp = client.get("/api/v1/brand-brain", headers={"Authorization": "Bearer nope"})
    assert resp.status_code == 401


def test_missing_token_is_401(client: TestClient):
    resp = client.get("/api/v1/brand-brain")
    assert resp.status_code == 401


def test_api_key_auth_resolves_company(client: TestClient, company_a: dict):
    resp = client.get("/api/v1/onboarding/check", headers=headers_key(company_a["token"]))
    assert resp.status_code == 200
    body = resp.json()
    assert body["authenticated"] is True
    assert str(body["company_id"]) == company_a["company_id"]


def test_dev_token_without_company_id_is_401(client: TestClient, company_a: dict):
    resp = client.get("/api/v1/brand-brain", headers={"Authorization": "Bearer test-dev-token-12345"})
    assert resp.status_code == 401


def test_dev_token_with_company_id_works(client: TestClient, company_a: dict):
    resp = client.get(
        "/api/v1/brand-brain",
        headers=headers_company("test-dev-token-12345", company_a["company_id"]),
    )
    assert resp.status_code == 200
