"""Shared pytest fixtures.

IMPORTANT: environment variables are set BEFORE importing the app, because
`app.config` snapshots settings at import time.
"""
from __future__ import annotations

import io
import os
import sys
import uuid
from pathlib import Path

import pytest
from PIL import Image

SERVER_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SERVER_DIR))

_TMP = SERVER_DIR / ".pytest-tmp"


def _setup_env() -> None:
    _TMP.mkdir(exist_ok=True)
    db_file = _TMP / "test.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_file}"
    os.environ["STORAGE_DIR"] = str(_TMP / "storage")
    os.environ["DEV_AUTH_TOKEN"] = "test-dev-token-12345"
    os.environ["PIPELINE_MODE"] = "mock"
    os.environ["RATE_LIMIT_PER_MINUTE"] = "100000"
    os.environ["STALE_JOB_AFTER_SECONDS"] = "60"
    os.environ["MAX_JOB_ATTEMPTS"] = "3"
    os.environ["ALLOWED_ORIGINS"] = "https://inkoom-ai.shubhamos.com"


_setup_env()

from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402

# Create the schema in the temporary test database (production uses Alembic).
Base.metadata.create_all(engine)


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


def _png_bytes(size: int = 300, color=(120, 40, 60)) -> bytes:
    img = Image.new("RGB", (size, size), color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture(scope="session")
def png():
    return _png_bytes()


def onboard(client, name="Tester") -> dict:
    """Create a fresh company; returns {user_id, company_id, token}."""
    resp = client.post(
        "/api/v1/onboarding",
        json={
            "name": name,
            "company_name": f"Company {uuid.uuid4().hex[:8]}",
            "industry": "Technology",
            "website": "https://example.com",
            "email": None,
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    return {
        "user_id": body["user_id"],
        "company_id": body["company_id"],
        "token": body["access_token"],
    }


@pytest.fixture()
def company_a(client):
    return onboard(client, "Owner A")


@pytest.fixture()
def company_b(client):
    return onboard(client, "Owner B")


def headers_company(token: str, company_id: str) -> dict:
    return {"Authorization": f"Bearer {token}", "X-Company-ID": company_id}


def headers_key(token: str) -> dict:
    """API-key auth: the company is derived from the key itself."""
    return {"Authorization": f"Bearer {token}"}


def run_queue_until(client, token: str, analysis_id: str, max_iterations: int = 30) -> str:
    """Drive the FIFO worker iterations until OUR analysis completes.

    Other companies' jobs may sit ahead of ours in the queue, so we keep
    pumping until the target analysis is done or.max iterations reached."""
    from app.services import job_service

    for _ in range(max_iterations):
        status = client.get(
            f"/api/v1/analysis/{analysis_id}/status", headers=headers_key(token)
        ).json()["status"]
        if status in ("completed", "failed", "cancelled"):
            return status
        if not job_service.worker_loop_once():
            break
    return client.get(
        f"/api/v1/analysis/{analysis_id}/status", headers=headers_key(token)
    ).json()["status"]


def add_rules(client, token: str) -> list[dict]:
    """Populate a few manual brand rules for a company."""
    rules = [
        {"category": "logo", "requirement": "Logo must appear in the top-right corner.",
         "severity": "critical", "source_text": "Keep the logo top-right at all times."},
        {"category": "colors", "requirement": "Only the two approved brand colors may be used.",
         "severity": "major", "source_text": "Use only approved brand colors."},
        {"category": "copy", "requirement": "Every headline ends with a period.",
         "severity": "info", "source_text": "Headlines always end with a period."},
    ]
    out = []
    for r in rules:
        resp = client.post("/api/v1/brand-brain/rules", json=r, headers=headers_key(token))
        assert resp.status_code == 200, resp.text
        out.append(resp.json())
    return out
