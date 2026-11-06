"""Image upload validation, job lifecycle, status polling, report, history."""
from __future__ import annotations

import io
import uuid

from fastapi.testclient import TestClient
from PIL import Image

from tests.conftest import add_rules, run_queue_until, headers_key


def _jpeg_bytes(size=250) -> bytes:
    img = Image.new("RGB", (size, size), (10, 90, 200))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def _submit(client, token, png: bytes, filename="ad.png"):
    return client.post(
        "/api/v1/analysis",
        files={"file": (filename, png, "image/png")},
        headers=headers_key(token),
    )


# ---------------------------------------------------------------------------
# Upload validation
# ---------------------------------------------------------------------------

def test_upload_rejects_non_image_content(company_a, client: TestClient, png: bytes):
    resp = client.post(
        "/api/v1/analysis",
        files={"file": ("report.pdf", b"%PDF-1.4 fake pdf", "application/pdf")},
        headers=headers_key(company_a["token"]),
    )
    assert resp.status_code == 422
    assert resp.json()["detail"]["error"] == "invalid_image"


def test_upload_rejects_forged_extension(company_a, client: TestClient):
    # .png name but this is a text file masquerading as an image.
    resp = client.post(
        "/api/v1/analysis",
        files={"file": ("ad.png", b"this is definitely not an image", "image/png")},
        headers=headers_key(company_a["token"]),
    )
    assert resp.status_code == 422


def test_upload_rejects_oversize_image(company_a, client: TestClient, png: bytes):
    big = png + b"\x00" * (16 * 1024 * 1024)
    resp = client.post(
        "/api/v1/analysis",
        files={"file": ("ad.png", big, "image/png")},
        headers=headers_key(company_a["token"]),
    )
    assert resp.status_code == 422


def test_upload_rejects_tiny_dimensions(company_a, client: TestClient):
    img = Image.new("RGB", (20, 20), (0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    resp = client.post(
        "/api/v1/analysis",
        files={"file": ("tiny.png", buf.getvalue(), "image/png")},
        headers=headers_key(company_a["token"]),
    )
    assert resp.status_code == 422


def test_upload_accepts_valid_png(company_a, client: TestClient, png: bytes):
    resp = _submit(client, company_a["token"], png)
    assert resp.status_code == 202, resp.text
    body = resp.json()
    assert uuid.UUID(str(body["analysis_id"]))
    assert body["status"] == "queued"
    assert "queued" in body["message"].lower()


# ---------------------------------------------------------------------------
# Job lifecycle
# ---------------------------------------------------------------------------

def test_full_mock_lifecycle(company_a, client: TestClient, png: bytes):
    token = company_a["token"]
    add_rules(client, token)
    submitted = _submit(client, token, png)
    analysis_id = submitted.json()["analysis_id"]

    # Status endpoint reflects queued while the worker hasn't run.
    resp = client.get(f"/api/v1/analysis/{analysis_id}/status", headers=headers_key(token))
    assert resp.status_code == 200
    assert resp.json()["status"] == "queued"

    # Report is not ready before completion -> 409 with honest info.
    resp = client.get(f"/api/v1/analysis/{analysis_id}", headers=headers_key(token))
    assert resp.status_code == 409
    assert resp.json()["detail"]["error"] == "analysis_not_completed"

    # Run the worker until THIS analysis completes (FIFO: others may precede it).
    final_status = run_queue_until(client, token, analysis_id)
    assert final_status == "completed"

    resp = client.get(f"/api/v1/analysis/{analysis_id}/status", headers=headers_key(token))
    status = resp.json()
    assert status["status"] == "completed"
    assert status["progress"] == 100

    # Now the full report is available and validated.
    resp = client.get(f"/api/v1/analysis/{analysis_id}", headers=headers_key(token))
    assert resp.status_code == 200
    report = resp.json()
    assert report["status"] == "completed"
    assert report["analysis_metadata"]["is_mock"] is True
    assert report["analysis_metadata"]["engine"] == "mock"
    # Mock honesty: no fabricated findings.
    assert report["violations"] == []
    assert len(report["inconclusive_checks"]) == 3
    for check in report["inconclusive_checks"]:
        assert check["state"] == "inconclusive"


def test_one_active_analysis_per_company(company_a, client: TestClient, png: bytes):
    token = company_a["token"]
    _submit(client, token, png)  # queued -> occupies the company slot
    second = _submit(client, token, png)
    assert second.status_code == 409
    assert second.json()["detail"]["error"] == "analysis_in_progress"
