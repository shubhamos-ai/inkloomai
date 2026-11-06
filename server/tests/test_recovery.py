"""Restart/crash recovery tests for the database-backed job queue."""
from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app.database import SessionLocal, utcnow
from app.models import AnalysisJob
from app.services import job_service
from tests.conftest import headers_key


def _make_job(client, company, png) -> str:
    resp = client.post(
        "/api/v1/analysis",
        files={"file": ("ad.png", png, "image/png")},
        headers=headers_key(company["token"]),
    )
    assert resp.status_code == 202
    return resp.json()["analysis_id"]


def _set_processing_with_old_heartbeat(analysis_id: str, seconds: float) -> None:
    with SessionLocal() as db:
        job = db.query(AnalysisJob).filter_by(analysis_id=uuid.UUID(analysis_id)).one()
        job.status = "processing"
        job.current_stage = "Checking brand policies"
        job.progress = 45
        job.started_at = utcnow()
        job.heartbeat_at = None  # simulated crash before any heartbeat
        job.attempts = 1
        db.add(job)
        db.commit()


def test_stale_processing_job_is_requeued(company_a, client: TestClient, png: bytes):
    analysis_id = _make_job(client, company_a, png)
    _set_processing_with_old_heartbeat(analysis_id, seconds=999)

    recovered = job_service.recover_stale_jobs(SessionLocal())
    assert recovered["requeued"] == 1

    resp = client.get(
        f"/api/v1/analysis/{analysis_id}/status", headers=headers_key(company_a["token"])
    )
    body = resp.json()
    assert body["status"] == "queued"
    assert "Recovering" in body["current_stage"]

    # The recovered job completes normally on the next worker pass.
    processed = job_service.worker_loop_once()
    assert processed is True
    resp = client.get(f"/api/v1/analysis/{analysis_id}", headers=headers_key(company_a["token"]))
    if resp.status_code == 200:  # analysis was picked back up and completed
        assert resp.json()["analysis_metadata"]["is_mock"] is True


def test_requeue_only_counts_stale_jobs(company_a, client: TestClient, png: bytes):
    analysis_id = _make_job(client, company_a, png)

    # Fresh heartbeat -> NOT stale -> recovery must not touch it.
    recovered = job_service.recover_stale_jobs(SessionLocal())
    assert recovered["stale_found"] == 0
    resp = client.get(
        f"/api/v1/analysis/{analysis_id}/status", headers=headers_key(company_a["token"])
    )
    assert resp.json()["status"] == "queued"


def test_max_attempts_marks_failed(company_a, client: TestClient, png: bytes):
    analysis_id = _make_job(client, company_a, png)

    with SessionLocal() as db:
        job = db.query(AnalysisJob).filter_by(analysis_id=uuid.UUID(analysis_id)).one()
        job.status = "processing"
        job.heartbeat_at = None
        job.attempts = 3  # == MAX -> recover as failed
        db.commit()

    recovered = job_service.recover_stale_jobs(SessionLocal())
    assert recovered["failed"] == 1

    resp = client.get(
        f"/api/v1/analysis/{analysis_id}/status", headers=headers_key(company_a["token"])
    )
    assert resp.json()["status"] == "failed"
    assert resp.json()["error"]


def test_cancel_queued_analysis(company_a, client: TestClient, png: bytes):
    analysis_id = _make_job(client, company_a, png)
    resp = client.post(f"/api/v1/analysis/{analysis_id}/cancel", headers=headers_key(company_a["token"]))
    assert resp.status_code == 200
    body = client.get(f"/api/v1/analysis/{analysis_id}/status", headers=headers_key(company_a["token"]))
    assert body.json()["status"] == "cancelled"


def test_cancelled_job_is_skipped_by_worker(company_a, client: TestClient, png: bytes):
    analysis_id = _make_job(client, company_a, png)
    client.post(f"/api/v1/analysis/{analysis_id}/cancel", headers=headers_key(company_a["token"]))
    # Worker loop still runs; nothing failed, nothing crashed.
    job_service.worker_loop_once()
    resp = client.get(f"/api/v1/analysis/{analysis_id}/status", headers=headers_key(company_a["token"]))
    assert resp.json()["status"] == "cancelled"
