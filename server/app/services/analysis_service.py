"""Analysis service — submission and pipeline execution.

Submission (API side) validates + persists the upload, creates the persistent
Analysis + AnalysisJob queue row, and returns immediately. Inference never
happens inside the HTTP request.

Pipeline (worker side) drives the job through stages, updating progress in the
database after every stage, and produces the final report.

Supports multiple vision providers:
- NVIDIA NIM (Llama 3.2 11B Vision) - production
- Ollama (local dev)
- Mock (testing)
"""
from __future__ import annotations

import time
import uuid

from fastapi import HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import utcnow
from app.engine import compliance_engine, ocr_engine, scoring_engine, vision_engine
from app.models import Analysis, AnalysisJob, Company
from app.schemas.analysis import AnalysisSubmitResponse
from app.schemas.report import AnalysisReport
from app.services import storage_service
from app.utils.validators import ImageValidationError, validate_image_upload

ACTIVE_JOB_STATUSES = ("queued", "processing")


# ---------------------------------------------------------------------------
# Submission (API side)
# ---------------------------------------------------------------------------

def submit_analysis(
    db: Session, company: Company, upload: UploadFile, *, brain_id: uuid.UUID | None = None
) -> AnalysisSubmitResponse:
    """Validate + persist an advertisement upload and enqueue its job.

    Guarantees:
    - At most one active analysis per company (HTTP 409 otherwise).
    - File content is validated by bytes, not only by extension.
    - The stored filename is server-generated; the client's name is display-only.
    """
    # Heavy inference is strictly sequential globally; per company only one
    # active analysis is allowed.
    active = db.scalar(
        select(AnalysisJob.id)
        .where(
            AnalysisJob.company_id == company.id,
            AnalysisJob.status.in_(ACTIVE_JOB_STATUSES),
        )
        .limit(1)
    )
    if active:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "analysis_in_progress",
                "message": "This company already has an analysis queued or processing.",
            },
        )

    data = upload.file.read()
    content_type = upload.content_type or "application/octet-stream"
    filename = upload.filename or "upload.png"

    try:
        validated = validate_image_upload(
            data=data,
            filename=filename,
            content_type=content_type,
            max_bytes=settings.max_upload_bytes,
            min_dim=settings.MIN_IMAGE_DIMENSION,
            max_dim=settings.MAX_IMAGE_DIMENSION,
        )
    except ImageValidationError as exc:
        raise HTTPException(status_code=422, detail={"error": "invalid_image", "message": str(exc)})

    analysis_id = uuid.uuid4()
    image_rel = storage_service.write_analysis_image(
        company.id, analysis_id, data=data, kind=validated.kind
    )
    # Generate and store thumbnail preview for durable rendering across restarts
    preview_rel = storage_service.write_analysis_preview(
        company.id, analysis_id, image_data=data
    )

    if brain_id is None:
        from app.services import brand_brain_service

        brain = brand_brain_service.get_or_create_brain(db, company)
        brain_id = brain.id

    # Determine engine based on provider
    engine_name = "mock"
    if settings.use_nvidia_nim:
        from app.services import nim_vision_service as _nim
        engine_name = _nim.get_vision_model()
    elif settings.use_ollama:
        engine_name = settings.OLLAMA_VISION_MODEL or "ollama"

    analysis = Analysis(
        id=analysis_id,
        company_id=company.id,
        brain_id=brain_id,
        image_path=image_rel,
        original_filename=filename,
        status="queued",
        engine=engine_name,
        is_mock=settings.use_mock,
    )
    db.add(analysis)
    db.flush()

    from app.services import asset_service

    asset_service.record_asset(
        db,
        company_id=company.id,
        analysis_id=analysis_id,
        kind="analysis_image",
        object_key=image_rel,
        original_filename=filename,
        content_type=content_type,
        preview_key=preview_rel,
        data=data,
    )

    job = AnalysisJob(
        analysis_id=analysis_id,
        company_id=company.id,
        status="queued",
        progress=0,
        current_stage="Queued",
        queued_at=utcnow(),
    )
    db.add(job)
    db.commit()

    return AnalysisSubmitResponse(analysis_id=analysis_id)


# ---------------------------------------------------------------------------
# Pipeline (worker side)
# ---------------------------------------------------------------------------

def _set_stage(db: Session, job_id: uuid.UUID, *, progress: int, stage: str) -> None:
    """Persist progress + heartbeat. Called between pipeline stages so that a
    crash resumes from a well-known point."""
    from sqlalchemy import update
    from app.models import AnalysisJob

    db.execute(
        update(AnalysisJob)
        .where(AnalysisJob.id == job_id)
        .values(progress=progress, current_stage=stage, heartbeat_at=utcnow())
    )
    db.commit()


def _use_mock_pipeline() -> bool:
    """Determine if mock pipeline should be used."""
    return settings.use_mock


def run_pipeline(job_id: uuid.UUID) -> None:
    """Execute one analysis job. Never raises; terminal state on every path."""
    from app.database import SessionLocal
    from app.services import brand_brain_service

    db = SessionLocal()
    try:
        job = db.get(AnalysisJob, job_id)
        if job is None or job.status not in ("queued", "processing"):
            return

        job.status = "processing"
        job.started_at = utcnow()
        job.attempts += 1
        job.heartbeat_at = utcnow()
        analysis = job.analysis
        analysis.status = "processing"
        db.commit()

        _set_stage(db, job.id, progress=10, stage="Preparing image")
        company = db.get(Company, analysis.company_id)

        _, rules = brand_brain_service.enabled_rules_as_dicts(db, company)
        use_mock = _use_mock_pipeline()

        # Stage 1 — visual observations (engine may raise NotConfiguredError).
        _set_stage(db, job.id, progress=30, stage="Analyzing visual composition")
        try:
            vision = vision_engine.analyze_image(
                str(storage_service.abs_path_for(analysis.image_path)), mock=use_mock
            )
        except vision_engine.NotConfiguredError:
            vision = vision_engine.mock_observations()

        # Stage 2 — exact text extraction (OCR or fallback).
        _set_stage(db, job.id, progress=50, stage="Extracting text from the image")
        try:
            ocr = ocr_engine.extract_text(
                str(storage_service.abs_path_for(analysis.image_path)), mock=use_mock
            )
        except ocr_engine.NotConfiguredError:
            ocr = ocr_engine.mock_ocr()

        # When no dedicated OCR engine exists, fall back to the text the vision
        # engine transcribed (real inference output, provenance-labelled).
        ocr_text = ocr.get("text", "")
        ocr_source = ocr.get("engine", "none")
        if ocr.get("is_mock") and not vision.get("is_mock"):
            transcribed = ocr_engine.text_from_vision(vision)
            if transcribed:
                ocr_text = transcribed
                ocr_source = "vision_transcription"

        # Stage 3 — rule-by-rule compliance evaluation.
        _set_stage(db, job.id, progress=75, stage="Checking brand policies")

        started = time.perf_counter()
        if use_mock:
            report = compliance_engine.mock_report_draft(
                analysis_id=str(analysis.id),
                rules=rules,
                vision=vision,
                ocr=ocr,
                ocr_text=ocr_text,
                vision_observations=vision.get("observations", []),
            )
        else:
            report = _ai_compliance_report(
                analysis_id=str(analysis.id), rules=rules, vision=vision, ocr_text=ocr_text
            )

        # Stage 4 — deterministic scoring (the LLM never picks the score).
        _set_stage(db, job.id, progress=90, stage="Scoring compliance")
        score, overall, summary = scoring_engine.score_report(report)

        meta = dict(report.get("analysis_metadata") or {})
        meta.setdefault("engine", vision.get("engine", "mock"))
        meta.setdefault("is_mock", use_mock)
        meta["duration_ms"] = int((time.perf_counter() - started) * 1000)
        meta["brand_rules_count"] = len(rules)
        meta["ocr_source"] = ocr_source
        report["analysis_metadata"] = meta

        # Stage 5 — validate and persist the report.
        _set_stage(db, job.id, progress=97, stage="Saving report")
        validated = AnalysisReport.model_validate(
            {**report, "compliance_score": score, "overall_status": overall, "summary": summary}
        )
        final = validated.model_dump(mode="json")

        analysis.report = final
        analysis.compliance_score = score
        analysis.overall_status = validated.overall_status
        analysis.summary = validated.summary
        analysis.engine = meta.get("engine", "mock")
        analysis.is_mock = bool(meta.get("is_mock", use_mock))
        storage_service.write_report_json(company.id, analysis.id, final)

        analysis.status = "completed"
        analysis.completed_at = utcnow()
        job.status = "completed"
        job.progress = 100
        job.current_stage = "Completed"
        job.completed_at = utcnow()
        job.heartbeat_at = utcnow()
        job.error = None
        db.commit()

    except Exception as exc:  # noqa: BLE001 — worker must degrade gracefully
        import traceback

        db.rollback()
        _mark_failed(
            job_id,
            safe_message=f"{type(exc).__name__}",
            debug="".join(traceback.format_exception(exc)) if settings.DEBUG else repr(exc),
        )
    finally:
        db.close()


def _ai_compliance_report(*, analysis_id: str, rules: list[dict], vision: dict, ocr_text: str) -> dict:
    """Real inference path — uses NVIDIA NIM or Ollama based on configuration."""
    from app.services import ollama_service

    # Use the appropriate service based on configuration
    if settings.use_nvidia_nim:
        from app.services import nim_vision_service as vision_service
    else:
        vision_service = ollama_service

    vision_kwargs: dict = {}
    if vision.get("image_b64"):
        vision_kwargs["images"] = [vision["image_b64"]]

    try:
        system, user = compliance_engine.build_prompt(rules, vision, ocr_text)
        raw_text = vision_service.generate(
            prompt=user,
            system=system,
            **vision_kwargs,
        )
        raw = vision_service.parse_json_loose(raw_text)

        # Some runs of the SLM answer with empty findings lists; retry once.
        # If still empty, validate_ai_output marks every rule inconclusive honestly.
        findings_empty = isinstance(raw, dict) and not (raw.get("violations") or raw.get("checks"))
        if findings_empty and rules:
            raw_text = vision_service.generate(prompt=user, system=system, **vision_kwargs)
            raw = vision_service.parse_json_loose(raw_text)

        # Determine engine name for metadata
        if settings.use_nvidia_nim:
            from app.services import nim_vision_service as _nim

            engine_name = _nim.get_vision_model()
        else:
            engine_name = settings.OLLAMA_VISION_MODEL

        return compliance_engine.validate_ai_output(
            raw=raw,
            analysis_id=analysis_id,
            rules=rules,
            metadata_extra={
                "model": engine_name,
                "vision_observations": vision.get("observations", []),
                "ocr_text": ocr_text,
            },
        )
    except Exception as exc:  # engine hiccup => honest inconclusive draft
        if settings.DEBUG:
            import traceback

            print(
                f"[analysis_service] _ai_compliance_report fallback: "
                + "".join(traceback.format_exception(exc))
            )
        return compliance_engine.mock_report_draft(
            analysis_id=analysis_id,
            rules=rules,
            vision={**vision, "note": f"AI inference failed safely: {type(exc).__name__}"},
            ocr={},
            ocr_text=ocr_text,
            vision_observations=vision.get("observations", []),
        )


def _mark_failed(job_id: uuid.UUID, *, safe_message: str, debug: str = "") -> None:
    """Mark the job (and analysis) failed with a safe error message. Never raises."""
    from app.database import SessionLocal
    from app.models import AnalysisJob

    db = SessionLocal()
    try:
        job = db.get(AnalysisJob, job_id)
        if job is None:
            return
        analysis = job.analysis
        job.status = "failed"
        job.error = safe_message
        job.current_stage = "Failed"
        job.completed_at = utcnow()
        job.heartbeat_at = utcnow()
        analysis.status = "failed"
        analysis.summary = safe_message
        db.commit()
        if settings.DEBUG and debug:
            print(f"[analysis_service] pipeline failure for job {job_id}: {debug}")
    except Exception:  # noqa: BLE001
        db.rollback()
    finally:
        db.close()