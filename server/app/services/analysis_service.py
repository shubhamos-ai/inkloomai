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
from collections.abc import Callable
from datetime import timedelta

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


class ProviderUnavailable(RuntimeError):
    """Transient AI provider failure. The job is retried with backoff."""


class ProviderMisconfigured(RuntimeError):
    """No usable AI provider. Terminal until the deployment is fixed."""


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

        # Stage 1 — visual observations. A missing provider is a terminal
        # configuration error; a provider outage is retryable.
        _set_stage(db, job.id, progress=30, stage="Analyzing visual composition")
        try:
            vision = vision_engine.analyze_image(
                str(storage_service.abs_path_for(analysis.image_path)), mock=use_mock
            )
        except vision_engine.NotConfiguredError as exc:
            raise ProviderMisconfigured(str(exc)) from exc
        except vision_engine.ProviderError as exc:
            raise ProviderUnavailable(str(exc)) from exc

        # Stage 2 — exact text extraction (OCR or fallback).
        _set_stage(db, job.id, progress=50, stage="Extracting text from the image")
        try:
            ocr = ocr_engine.extract_text(
                str(storage_service.abs_path_for(analysis.image_path)), mock=use_mock
            )
        except ocr_engine.NotConfiguredError:
            # OCR is optional: the vision model transcribes visible text.
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
            def _compliance_progress(done: int, total: int) -> None:
                stage = "Checking brand policies"
                if total > 1:
                    stage = f"Checking brand policies ({done}/{total} batches)"
                _set_stage(db, job.id, progress=75, stage=stage)

            report = _ai_compliance_report(
                analysis_id=str(analysis.id),
                rules=rules,
                vision=vision,
                ocr_text=ocr_text,
                heartbeat=_compliance_progress,
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
        job.error_code = None
        job.next_attempt_at = None
        job.locked_by = None
        db.commit()

    except ProviderMisconfigured as exc:
        db.rollback()
        _mark_failed(
            job_id,
            safe_message=str(exc),
            error_code="configuration_error",
            retryable=False,
        )
    except ProviderUnavailable as exc:
        db.rollback()
        _mark_failed(
            job_id,
            safe_message=str(exc),
            error_code="provider_error",
            retryable=True,
        )
    except Exception as exc:  # noqa: BLE001 — worker must degrade gracefully
        import traceback

        db.rollback()
        _mark_failed(
            job_id,
            safe_message=f"Analysis failed ({type(exc).__name__}).",
            error_code="internal_error",
            retryable=True,
            debug="".join(traceback.format_exception(exc)) if settings.DEBUG else repr(exc),
        )
    finally:
        db.close()


def _ai_compliance_report(
    *,
    analysis_id: str,
    rules: list[dict],
    vision: dict,
    ocr_text: str,
    heartbeat: Callable[[int, int], None] | None = None,
) -> dict:
    """Real inference path — uses NVIDIA NIM or Ollama based on configuration.

    A large rulebook is evaluated in batches. Sending 50+ rules in one request
    overflows the provider's completion budget and returns truncated JSON; each
    batch stays comfortably inside it. A malformed batch degrades to
    inconclusive for its rules instead of failing the whole audit, while a real
    provider outage still raises a retryable error.
    """
    from app.services import ollama_service

    # Use the appropriate service based on configuration
    if settings.use_nvidia_nim:
        from app.services import nim_vision_service as vision_service
    else:
        vision_service = ollama_service

    vision_kwargs: dict = {}
    if vision.get("image_b64"):
        vision_kwargs["images"] = [vision["image_b64"]]

    # NIM accepts an explicit budget/timeout; the Ollama client does not.
    generate_kwargs = dict(vision_kwargs)
    if settings.use_nvidia_nim:
        generate_kwargs["max_tokens"] = settings.COMPLIANCE_MAX_TOKENS
        generate_kwargs["timeout"] = settings.COMPLIANCE_TIMEOUT_SECONDS

    batch_size = max(1, int(settings.COMPLIANCE_BATCH_SIZE))
    batches = [rules[i : i + batch_size] for i in range(0, len(rules), batch_size)] or [[]]

    merged_checks: list[dict] = []
    merged_violations: list[dict] = []
    merged_recommendations: list[str] = []
    summaries: list[str] = []
    failed_batches = 0

    def _run_batch(system: str, user: str, batch: list[dict]) -> dict:
        """Call the provider for one batch with one transient-error retry.

        A single 429/5xx used to restart the whole audit (vision included).
        Retrying just the failed batch keeps a transient hiccup cheap.
        """
        for attempt in range(2):
            try:
                raw_text = vision_service.generate(
                    prompt=user,
                    system=system,
                    **generate_kwargs,
                )
                raw = vision_service.parse_json_loose(raw_text)
            except ValueError:
                raise
            except RuntimeError:
                if attempt == 0:
                    time.sleep(2)
                    continue
                raise

            # Some runs of the SLM answer with empty findings lists; retry
            # once. If still empty, the validator marks every rule in this
            # batch inconclusive honestly.
            findings_empty = isinstance(raw, dict) and not (
                raw.get("violations") or raw.get("checks")
            )
            if findings_empty and batch:
                raw_text = vision_service.generate(
                    prompt=user,
                    system=system,
                    **generate_kwargs,
                )
                raw = vision_service.parse_json_loose(raw_text)
            return raw

        raise RuntimeError("Compliance batch failed without a response.")

    try:
        for index, batch in enumerate(batches, start=1):
            if heartbeat:
                heartbeat(index - 1, len(batches))

            system, user = compliance_engine.build_prompt(batch, vision, ocr_text)
            try:
                raw = _run_batch(system, user, batch)
            except ValueError:
                # Truncated or unparseable batch: leave its rules inconclusive
                # rather than retrying the entire audit forever.
                failed_batches += 1
                continue

            if not isinstance(raw, dict):
                failed_batches += 1
                continue

            summary = str(raw.get("summary") or "").strip()
            if summary:
                summaries.append(summary)
            merged_checks.extend(
                c for c in (raw.get("checks") or []) if isinstance(c, dict)
            )
            merged_violations.extend(
                v for v in (raw.get("violations") or []) if isinstance(v, dict)
            )
            merged_recommendations.extend(
                str(x) for x in (raw.get("recommendations") or []) if x
            )

            if heartbeat:
                heartbeat(index, len(batches))

        if failed_batches == len(batches) and rules:
            raise ProviderUnavailable(
                "AI compliance analysis returned no usable output for any rule batch."
            )

        merged = {
            "summary": " ".join(dict.fromkeys(summaries))[:2000],
            "checks": merged_checks,
            "violations": merged_violations,
            "recommendations": list(dict.fromkeys(merged_recommendations))[:20],
        }

        # Determine engine name for metadata
        if settings.use_nvidia_nim:
            from app.services import nim_vision_service as _nim

            engine_name = _nim.get_vision_model()
        else:
            engine_name = settings.OLLAMA_VISION_MODEL

        return compliance_engine.validate_ai_output(
            raw=merged,
            analysis_id=analysis_id,
            rules=rules,
            metadata_extra={
                "model": engine_name,
                "vision_observations": vision.get("observations", []),
                "ocr_text": ocr_text,
                "compliance_batches": len(batches),
                "compliance_failed_batches": failed_batches,
            },
        )
    except ProviderUnavailable:
        raise
    except Exception as exc:  # noqa: BLE001 — surface a retryable failure
        if settings.DEBUG:
            import traceback

            print(
                f"[analysis_service] AI compliance inference failed: "
                + "".join(traceback.format_exception(exc))
            )
        # Never fabricate a report. The worker retries, then marks the job
        # failed with an honest error the user can retry manually.
        raise ProviderUnavailable(
            f"AI compliance analysis failed ({type(exc).__name__})."
        ) from exc


def _mark_failed(
    job_id: uuid.UUID,
    *,
    safe_message: str,
    error_code: str = "internal_error",
    retryable: bool = True,
    debug: str = "",
) -> None:
    """Requeue with backoff or mark the job failed. Never raises.

    Retryable failures are re-queued until MAX_JOB_ATTEMPTS is exhausted; only
    then do the job and analysis become terminal `failed`.
    """
    from app.database import SessionLocal
    from app.models import AnalysisJob

    db = SessionLocal()
    try:
        job = db.get(AnalysisJob, job_id)
        if job is None:
            return
        analysis = job.analysis
        job.error = safe_message
        job.error_code = error_code
        job.heartbeat_at = utcnow()
        job.locked_by = None

        if retryable and job.attempts < settings.MAX_JOB_ATTEMPTS:
            delay = min(
                settings.JOB_BACKOFF_BASE_SECONDS * (2 ** max(job.attempts - 1, 0)),
                settings.JOB_BACKOFF_MAX_SECONDS,
            )
            job.status = "queued"
            job.current_stage = "Waiting to retry"
            job.next_attempt_at = utcnow() + timedelta(seconds=delay)
            job.completed_at = None
            analysis.status = "queued"
            analysis.summary = safe_message
        else:
            job.status = "failed"
            job.current_stage = "Failed"
            job.next_attempt_at = None
            job.completed_at = utcnow()
            analysis.status = "failed"
            analysis.summary = safe_message
        db.commit()
        if settings.DEBUG and debug:
            print(f"[analysis_service] pipeline failure for job {job_id}: {debug}")
    except Exception:  # noqa: BLE001
        db.rollback()
    finally:
        db.close()