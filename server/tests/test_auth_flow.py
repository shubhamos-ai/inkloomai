"""Netflix-style onboarding: /auth register, login, me, session resolution."""
from __future__ import annotations

import uuid

from tests.conftest import headers, headers_key


def _register(client, email=None, password="correcthorse9"):
    email = email or f"wizard-{uuid.uuid4().hex[:8]}@example.com"
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password},
    )
    return resp, email


def test_register_login_and_me(client):
    resp, email = _register(client)
    assert resp.status_code == 201, resp.text
    token = resp.json()["session_token"]
    assert token.startswith("il_sess_")

    # /me works without a company (no X-Company-ID needed)
    me = client.get("/api/v1/auth/me", headers=headers_key(token))
    assert me.status_code == 200
    body = me.json()
    assert body["companies"] == []
    assert body["user"]["email"] == email

    # login returns a fresh valid session
    login = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "correcthorse9"}
    )
    assert login.status_code == 200
    assert login.json()["session_token"].startswith("il_sess_")

    # wrong password -> generic 401
    bad = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "nope"}
    )
    assert bad.status_code == 401

    # duplicate email register -> 409
    dup, _ = _register(client, email=email)
    assert dup.status_code == 409


def test_register_validation(client):
    short = client.post(
        "/api/v1/auth/register", json={"email": "x@y.com", "password": "short1"}
    )
    assert short.status_code == 422
    bad_email = client.post(
        "/api/v1/auth/register", json={"email": "not-an-email", "password": "correcthorse9"}
    )
    assert bad_email.status_code == 422


def test_session_resolves_company_via_onboarding(client):
    """Register -> PATCH name -> create company through /onboarding -> session
    token now resolves to that company for protected endpoints."""
    resp, _ = _register(client, email=f"builder-{uuid.uuid4().hex[:8]}@example.com")
    token = resp.json()["session_token"]

    me = client.patch(
        "/api/v1/auth/me", headers=headers(token), json={"name": "Shub the Builder"}
    )
    assert me.status_code == 200, me.text
    assert me.json()["user"]["name"] == "Shub the Builder"

    created = client.post(
        "/api/v1/onboarding",
        headers=headers(token),
        json={"name": "Shub the Builder", "company_name": "Wizard Ads"},
    )
    assert created.status_code == 200, created.text
    company_id = created.json()["company_id"]

    me = client.get("/api/v1/auth/me", headers=headers_key(token))
    companies = me.json()["companies"]
    assert [c["company_name"] for c in companies] == ["Wizard Ads"]

    # Session token resolves to their only company without X-Company-ID
    check = client.get("/api/v1/onboarding/check", headers=headers_key(token))
    assert check.status_code == 200
    assert check.json()["auth_mode"] == "session"
    assert check.json()["company_name"] == "Wizard Ads"

    # Two companies -> header picks the active one
    second = client.post(
        "/api/v1/onboarding",
        headers=headers(token),
        json={"name": "Shub the Builder", "company_name": "Wizard Ads 2"},
    )
    assert second.status_code == 200
    second_id = second.json()["company_id"]

    me = client.get("/api/v1/auth/me", headers=headers_key(token))
    assert len(me.json()["companies"]) == 2

    picked = client.get(
        "/api/v1/onboarding/check",
        headers=headers(token, f"x-company-id: {second_id}"),
    )
    assert picked.status_code == 200
    assert picked.json()["company_name"] == "Wizard Ads 2"

    # Foreign company id -> 401
    other = client.post(
        "/api/v1/onboarding", json={"name": "Other", "company_name": "Co"}
    ).json()
    cid = other["company_id"]
    foreign = client.get(
        "/api/v1/onboarding/check", headers=headers(token, f"x-company-id: {cid}")
    )
    assert foreign.status_code == 401

    # Protected endpoints refuse sessions with no company attached
    fresh, _ = _register(client, email=f"nocorp-{uuid.uuid4().hex[:8]}@example.com")
    denied = client.get("/api/v1/brand-brain", headers=headers(fresh.json()["session_token"]))
    assert denied.status_code == 401
    assert denied.json()["detail"]["error"] == "company_required"

    # logout invalidates the session
    out = client.post("/api/v1/auth/logout", headers=headers_key(token))
    assert out.status_code == 200
    dead = client.get("/api/v1/auth/me", headers=headers_key(token))
    assert dead.status_code == 401


def test_legacy_onboarding_unchanged(client):
    """The old dev/onboarding flow (no session) keeps working."""
    resp = client.post(
        "/api/v1/onboarding", json={"name": "Old", "company_name": "Legacy Co"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["access_token"].startswith("ik_dev_")
    # a second company can be created without a session — each gets its own key
    resp2 = client.post(
        "/api/v1/onboarding", json={"name": "Old", "company_name": "Legacy Co 2"}
    )
    assert resp2.status_code == 200


def test_foreign_company_owned_by_other_user_blocked(client):
    """A session user cannot point X-Company-ID at someone else's company."""
    legacy = client.post(
        "/api/v1/onboarding", json={"name": "Owner", "company_name": "Foreign Co"}
    ).json()
    foreign_cid = legacy["company_id"]

    resp, _ = _register(client)
    token = resp.json()["session_token"]
    blocked = client.get(
        "/api/v1/onboarding/check",
        headers=headers(token, f"x-company-id: {foreign_cid}"),
    )
    assert blocked.status_code == 401
    assert blocked.json()["detail"]["error"] == "company_forbidden"
