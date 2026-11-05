"""Job service — the persistent, restart-safe background queue.

Design:
- `analysis_jobs` table IS the queue (SQLite/Postgres-backed, survives restarts).
- A single worker claims one job at a time -> only one heavy inference runs
  at a time on the machine.
- A company may have at most one active job (enforced on submission).
- Crash recovery: at startup (and on each loop) jobs stuck in `processing`
  with no heartbeat for STALE_JOB_AFTER_SECONDS are requeued or failed.

The worker entry point is `python -m app.worker`.
"""
from __future__ import annotations

import uuid
from datetime import timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.config import settings
from app.database import utcnow
from app.models import AnalysisJob

ACTIVE_JOB_STATUSES = ("queued", "processing")


def queue_depth(db: Session) -> dict:
    queued = len(db.scalars(select(AnalysisJob.id).where(AnalysisJob.status == "queued")).all())
    processing = len(
        db.scalars(select(AnalysisJob.id).where(AnalysisJob.status == "processing")).all()
    )
    return {"queued": queued, "processing": processing}


def claim_next_job(db: Session) -> AnalysisJob | None:
    """Atomically claim the oldest queued job whose company has no active job.

    Uses a guarded UPDATE (status flips only while still 'queued'), so even if
    two workers raced, only one would win the claim.
    """
    job = db.scalar(
        select(AnalysisJob)
        .where(AnalysisJob.status == "queued")
        .order_by(AnalysisJob.queued_at.asc(), AnalysisJob.id.asc())
        .limit(1)
    )
    if job is None:
        return None

    company_active = db.scalar(
        select(AnalysisJob.id).where(
            AnalysisJob.company_id == job.company_id,
            AnalysisJob.status.in_(ACTIVE_JOB_STATUSES),
            AnalysisJob.id != job.id,
        )
    )
    if company_active:
        # Another company's job comes first instead.
        jobs = db.scalars(
            select(AnalysisJob)
            .where(AnalysisJob.status == "queued")
            .order_by(AnalysisJob.queued_at.asc(), AnalysisJob.id.asc())
        ).all()
        for candidate in jobs:
            clash = db.scalar(
                select(AnalysisJob.id).where(
                    AnalysisJob.company_id == candidate.company_id,
                    AnalysisJob.status.in_(ACTIVE_JOB_STATUSES),
                    AnalysisJob.id != candidate.id,
                )
            )
            if not clash:
                job = candidate
                break
        else:
            return None

    result = db.execute(
        update(AnalysisJob)
        .where(AnalysisJob.id == job.id, AnalysisJob.status == "queued")
        .values(status="processing", started_at=utcnow(), heartbeat_at=utcnow(), error=None)
    )
    db.commit()
    if result.rowcount == 0:  # raced with another worker
        return None
    db.refresh(job)
    return job


def recover_stale_jobs(db: Session) -> dict:
    """Recover jobs left 'processing' by a crash/kill.

    Strategy (attempts-aware):
    - attempts < MAX: requeue (progress preserved, resumes from stage 0 of a
      fresh attempt — the pipeline is effectively idempotent because reports
      are only written at the end).
    - attempts >= MAX: mark failed with a safe message.

    Returns counts for logging/tests. Only stale jobs are touched — a live
    worker heartbeats, so it is never interrupted.
    """
    stale_before = utcnow() - timedelta(seconds=settings.STALE_JOB_AFTER_SECONDS)
    stuck = db.scalars(
        select(AnalysisJob).where(
            AnalysisJob.status == "processing",
            (AnalysisJob.heartbeat_at.is_(None)) | (AnalysisJob.heartbeat_at < stale_before),
        )
    ).all()

    requeued, failed = 0, 0
    for job in stuck:
        if job.attempts < settings.MAX_JOB_ATTEMPTS:
            _retry_stuck(db, job)
            requeued += 1
        else:
            _fail_stuck(db, job, reason="Analysis was interrupted and could not be resumed.")
            failed += 1
    if requeued or failed:
        db.commit()
    return {"requeued": requeued, "failed": failed, "stale_found": len(stuck)}


def _retry_stuck(db: Session, job: AnalysisJob) -> None:
    from app.models import Analysis

    db.execute(
        update(AnalysisJob)
        .where(AnalysisJob.id == job.id)
        .values(
            status="queued",
            current_stage=f"Recovering (was: {job.current_stage or 'processing'})",
            error=None,
            progress=min(job.progress, 5),
            heartbeat_at=utcnow(),
        )
    )
    if job.analysis:
        db.execute(
            update(Analysis)
            .where(Analysis.id == job.analysis_id)
            .values(status="queued", updated_at=utcnow())
        )


def _fail_stuck(db: Session, job: AnalysisJob, *, reason: str) -> None:
    from app.models import Analysis

    db.execute(
        update(AnalysisJob)
        .where(AnalysisJob.id == job.id)
        .values(
            status="failed",
            current_stage="Failed",
            error=reason,
            completed_at=utcnow(),
            heartbeat_at=utcnow(),
        )
    )
    if job.analysis:
        db.execute(
            update(Analysis)
            .where(Analysis.id == job.analysis_id)
            .values(status="failed", summary=reason, updated_at=utcnow())
        )


def cancel_job(db: Session, company_id: uuid.UUID, job_id: uuid.UUID) -> bool | None:
    """Cancel a queued job for a company. `None` means job not found/owned."""
    job = db.get(AnalysisJob, job_id)
    if job is None or job.company_id != company_id:
        return None
    if job.status != "queued":
        return False
    job.status = "cancelled"
    job.completed_at = utcnow()
    if job.analysis:
        job.analysis.status = "cancelled"
    db.commit()
    return True


def worker_loop_once() -> bool:
    """One worker iteration: recover stale work, process one job if claimable.

    Returns True when a job was processed.
    """
    from app.database import SessionLocal
    from app.services import analysis_service

    with SessionLocal() as db:
        recover_stale_jobs(db)
        job = claim_next_job(db)
        job_id = job.id if job else None

    if job_id:
        analysis_service.run_pipeline(job_id)
        return True
    return False
