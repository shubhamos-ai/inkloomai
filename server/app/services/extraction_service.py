"""AI brand-rule extraction service.

Flow
----
1. `POST /brand-brain/extract` calls `enqueue_extraction` -> durable
   `extraction_runs` row (the same queue the dedicated worker drains).
2. The worker claims the run, snapshots the brain text, calls the configured
   text/vision model, validates every proposal against the source, and stores
   the staged proposals. Nothing is written to `brand_rules` yet.
3. The user reviews/edits the proposals and `POST /brand-brain/extract/{id}/commit`
   persists the accepted ones with immutable version history.
"""
from __future__ import annotations

import uuid
from datetime import timedelta
from typing import Any, Optional

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.config import settings
from app.database import utcnow
from app.engine import extraction_engine
from app.models import BrandBrain, BrandRule, Company, ExtractionRun
from app.services import brand_brain_service

ACTIVE_STATUSES = ("queued", "processing")


class ExtractionNotConfigured(RuntimeError):
    """No text model is configured. Terminal (configuration) failure."""


class ExtractionProviderError(RuntimeError):
    """The provider failed transiently. Retryable with backoff."""


# ---------------------------------------------------------------------------
# Queue (API side)
# ---------------------------------------------------------------------------

def enqueue_extraction(
    db: Session, company: Company, *, user_id: Optional[uuid.UUID] = None
) -> ExtractionRun:
    brain = brand_brain_service.get_or_create_brain(db, company)
    source = (brain.original_rules_text or "").strip()
    if not source:
        raise ValueError("Add brand guidelines before running extraction.")

    active = db.scalar(
        select(ExtractionRun)
        .where(
            ExtractionRun.company_id == company.id,
            ExtractionRun.status.in_(ACTIVE_STATUSES),
        )
        .order_by(ExtractionRun.created_at.desc())
        .limit(1)
    )
    if active is not None:
        return active  # idempotent: reuse the in-flight run

    run = ExtractionRun(
        company_id=company.id,
        brain_id=brain.id,
        created_by_user_id=user_id,
        status="queued",
        max_attempts=settings.MAX_JOB_ATTEMPTS,
        source_version=brain.version,
        source_chars=len(source),
        model=settings.EXTRACTION_MODEL or settings.extraction_provider_name,
        queued_at=utcnow(),
    )
    db.add(run)
    brain.extraction_status = "queued"
    db.commit()
    db.refresh(run)
    return run


def get_run(db: Session, company: Company, run_id: uuid.UUID) -> ExtractionRun | None:
    run = db.get(ExtractionRun, run_id)
    if run is None or run.company_id != company.id:
        return None
    return run


def latest_run(db: Session, company: Company) -> ExtractionRun | None:
    return db.scalar(
        select(ExtractionRun)
        .where(ExtractionRun.company_id == company.id)
        .order_by(ExtractionRun.created_at.desc())
        .limit(1)
    )


def list_runs(db: Session, company: Company, *, limit: int = 20) -> list[ExtractionRun]:
    return list(
        db.scalars(
            select(ExtractionRun)
            .where(ExtractionRun.company_id == company.id)
            .order_by(ExtractionRun.created_at.desc())
            .limit(max(1, min(limit, 100)))
        ).all()
    )


# ---------------------------------------------------------------------------
# Worker side
# ---------------------------------------------------------------------------

def claim_next_extraction(db: Session) -> ExtractionRun | None:
    """Atomically claim the oldest claimable extraction run."""
    now = utcnow()
    run = db.scalar(
        select(ExtractionRun)
        .where(
            ExtractionRun.status == "queued",
            (ExtractionRun.next_attempt_at.is_(None)) | (ExtractionRun.next_attempt_at <= now),
        )
        .order_by(ExtractionRun.queued_at.asc(), ExtractionRun.id.asc())
        .limit(1)
    )
    if run is None:
        return None

    result = db.execute(
        update(ExtractionRun)
        .where(ExtractionRun.id == run.id, ExtractionRun.status == "queued")
        .values(status="processing", started_at=utcnow(), heartbeat_at=utcnow(), error=None)
    )
    db.commit()
    if result.rowcount == 0:
        return None
    db.refresh(run)
    return run


def recover_stale_extractions(db: Session) -> dict:
    stale_before = utcnow() - timedelta(seconds=settings.STALE_JOB_AFTER_SECONDS)
    stuck = db.scalars(
        select(ExtractionRun).where(
            ExtractionRun.status == "processing",
            (ExtractionRun.heartbeat_at.is_(None)) | (ExtractionRun.heartbeat_at < stale_before),
        )
    ).all()

    requeued = failed = 0
    for run in stuck:
        if run.attempts < run.max_attempts:
            run.status = "queued"
            run.error = None
            run.error_code = None
            run.next_attempt_at = None
            run.heartbeat_at = utcnow()
            requeued += 1
        else:
            _finish_failed(
                db,
                run,
                message="Rule extraction was interrupted and could not be resumed.",
                code="internal_error",
            )
            failed += 1
    if requeued or failed:
        db.commit()
    return {"requeued": requeued, "failed": failed, "stale_found": len(stuck)}


def run_extraction(run_id: uuid.UUID) -> None:
    """Execute one extraction run. Never raises; always reaches a terminal state."""
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        run = db.get(ExtractionRun, run_id)
        if run is None or run.status not in ACTIVE_STATUSES:
            return

        run.status = "processing"
        run.attempts += 1
        run.started_at = utcnow()
        run.heartbeat_at = utcnow()
        brain = db.get(BrandBrain, run.brain_id)
        if brain is None:
            _finish_failed(db, run, message="Brand Brain not found.", code="internal_error")
            return
        source_text = brain.original_rules_text or ""
        db.commit()

        try:
            raw_text, model_name = _call_model(source_text)
            run.model = model_name
            raw = extraction_engine.parse_model_output(raw_text)
            proposals, rejected, warnings = extraction_engine.validate_proposals(raw, source_text)
        except ExtractionNotConfigured as exc:
            _finish_failed(db, run, message=str(exc), code="configuration_error")
            return
        except ExtractionProviderError as exc:
            _finish_failed(db, run, message=str(exc), code="provider_error")
            return

        run.proposed_rules = proposals
        run.rejected_rules = rejected
        run.warnings = warnings
        run.status = "completed"
        run.completed_at = utcnow()
        run.heartbeat_at = utcnow()
        run.error = None
        run.error_code = None
        brain.structured_rules = proposals
        brain.extraction_status = "extracted" if proposals else "failed"
        db.commit()

    except Exception as exc:  # noqa: BLE001 — worker must never crash
        import traceback

        db.rollback()
        run = db.get(ExtractionRun, run_id)
        if run is not None:
            _finish_failed(
                db,
                run,
                message=f"Extraction failed ({type(exc).__name__}).",
                code="internal_error",
                debug="".join(traceback.format_exception(exc)),
            )
    finally:
        db.close()


def _call_model(source_text: str) -> tuple[str, str]:
    provider = settings.extraction_provider_name
    if provider == "not_configured":
        raise ExtractionNotConfigured(
            "No AI text model is configured. Set NVIDIA_API_KEY (production) or "
            "OLLAMA_VISION_MODEL (local), then retry."
        )

    system, user = extraction_engine.build_prompt(source_text)
    model = settings.EXTRACTION_MODEL or None
    try:
        if provider == "nvidia_nim":
            from app.services import nim_vision_service

            text = nim_vision_service.generate(
                prompt=user,
                system=system,
                model=model,
                max_tokens=4096,
                timeout=settings.EXTRACTION_TIMEOUT_SECONDS,
            )
            return text, model or nim_vision_service.get_vision_model()
        from app.services import ollama_service

        text = ollama_service.generate(prompt=user, system=system, model=model)
        return text, model or (settings.OLLAMA_VISION_MODEL or "ollama")
    except Exception as exc:  # noqa: BLE001 — provider outage is retryable
        raise ExtractionProviderError(
            f"AI provider request failed ({type(exc).__name__})."
        ) from exc


def _finish_failed(
    db: Session,
    run: ExtractionRun,
    *,
    message: str,
    code: str,
    debug: str = "",
) -> None:
    retryable = code in ("provider_error", "internal_error")
    if retryable and run.attempts < run.max_attempts:
        delay = min(
            settings.JOB_BACKOFF_BASE_SECONDS * (2 ** max(run.attempts - 1, 0)),
            settings.JOB_BACKOFF_MAX_SECONDS,
        )
        run.status = "queued"
        run.error = message
        run.error_code = code
        run.next_attempt_at = utcnow() + timedelta(seconds=delay)
        run.heartbeat_at = utcnow()
        brain = db.get(BrandBrain, run.brain_id)
        if brain is not None:
            brain.extraction_status = "queued"
    else:
        run.status = "failed"
        run.error = message
        run.error_code = code
        run.completed_at = utcnow()
        run.heartbeat_at = utcnow()
        run.next_attempt_at = None
        brain = db.get(BrandBrain, run.brain_id)
        if brain is not None:
            brain.extraction_status = "failed"
    db.commit()
    if settings.DEBUG and debug:
        print(f"[extraction_service] run {run.id} failure: {debug}")


def retry_run(db: Session, company: Company, run_id: uuid.UUID) -> ExtractionRun | None:
    run = get_run(db, company, run_id)
    if run is None:
        return None
    if run.status in ACTIVE_STATUSES:
        return run
    if run.committed_at is not None:
        raise ValueError("This extraction has already been committed.")
    run.status = "queued"
    run.attempts = 0
    run.error = None
    run.error_code = None
    run.next_attempt_at = None
    run.completed_at = None
    run.queued_at = utcnow()
    brain = db.get(BrandBrain, run.brain_id)
    if brain is not None:
        brain.extraction_status = "queued"
    db.commit()
    db.refresh(run)
    return run


# ---------------------------------------------------------------------------
# Human review / commit
# ---------------------------------------------------------------------------

def commit_run(
    db: Session,
    company: Company,
    run_id: uuid.UUID,
    *,
    rules: list[dict],
    user_id: Optional[uuid.UUID] = None,
) -> tuple[list[BrandRule], list[dict]]:
    """Persist reviewed proposals as BrandRule rows + version history.

    `rules` entries may reference `proposal_id` or contain the full fields.
    Returns (created_rules, skipped).
    """
    run = get_run(db, company, run_id)
    if run is None:
        raise LookupError("Extraction run not found.")
    if run.status != "completed":
        raise ValueError("Only a completed extraction can be committed.")
    if run.committed_at is not None:
        raise ValueError("This extraction has already been committed.")

    proposals = {p.get("proposal_id"): p for p in (run.proposed_rules or []) if isinstance(p, dict)}
    created: list[BrandRule] = []
    skipped: list[dict] = []
    source_type = f"ai_extraction:{run.id}"

    for entry in rules:
        if not isinstance(entry, dict):
            continue
        proposal = proposals.get(str(entry.get("proposal_id") or "")) or {}
        requirement = str(entry.get("requirement") or proposal.get("requirement") or "").strip()
        source_text = str(entry.get("source_text") or proposal.get("source_text") or "").strip()
        category = str(entry.get("category") or proposal.get("category") or "general").strip()
        severity = str(entry.get("severity") or proposal.get("severity") or "major").strip()

        if not requirement or not source_text:
            skipped.append({"proposal_id": entry.get("proposal_id"), "reason": "missing fields"})
            continue
        if severity not in extraction_engine.ALLOWED_SEVERITIES:
            severity = "major"
        category = category.lower().replace(" ", "_")[:60] or "general"

        rule = brand_brain_service.create_rule(
            db,
            company,
            category=category,
            requirement=requirement[:4000],
            severity=severity,
            source_text=source_text[:8000],
            source_type=source_type,
            extraction_run_id=run.id,
            user_id=user_id,
            change_type="extraction_committed",
        )
        created.append(rule)

    run.committed_at = utcnow()
    run.committed_rule_count = len(created)
    brain = db.get(BrandBrain, run.brain_id)
    if brain is not None:
        brain.extraction_status = "ai_extracted"
        brain.structured_rules = [
            {
                "id": str(r.id),
                "code": r.code,
                "category": r.category,
                "requirement": r.requirement,
                "severity": r.severity,
                "source_text": r.source_text,
            }
            for r in created
        ]
    db.commit()
    return created, skipped


def serialize_run(run: ExtractionRun) -> dict[str, Any]:
    return {
        "id": str(run.id),
        "company_id": str(run.company_id),
        "status": run.status,
        "attempts": run.attempts,
        "max_attempts": run.max_attempts,
        "source_version": run.source_version,
        "source_chars": run.source_chars,
        "model": run.model,
        "proposed_rules": run.proposed_rules or [],
        "rejected_rules": run.rejected_rules or [],
        "warnings": run.warnings or [],
        "error": run.error,
        "error_code": run.error_code,
        "created_at": run.created_at.isoformat() + "Z",
        "completed_at": (run.completed_at.isoformat() + "Z") if run.completed_at else None,
        "committed_at": (run.committed_at.isoformat() + "Z") if run.committed_at else None,
        "committed_rule_count": run.committed_rule_count,
        "next_attempt_at": (
            run.next_attempt_at.isoformat() + "Z" if run.next_attempt_at else None
        ),
    }


def worker_loop_once() -> bool:
    """One extraction worker iteration. Returns True when a run was processed."""
    from app.database import SessionLocal

    with SessionLocal() as db:
        run = claim_next_extraction(db)
        run_id = run.id if run else None

    if run_id is None:
        return False
    run_extraction(run_id)
    return True
