"""Advertisement analysis endpoints.

Contract (stable for the frontend):
  POST   /analysis                     -> submit image, returns immediately
  GET    /analysis/{id}/status         -> live progress (poll this)
  GET    /analysis/{id}                -> full validated report
  GET    /analysis/history             -> paginated, newest first
  POST   /analysis/{id}/cancel         -> cancel a queued analysis
  GET    /analysis/{id}/image          -> the stored upload (authorised)
"""
from __future__ import annotations

import uuid

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Request,
    UploadFile,
)
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import current_company, get_isolated_analysis, resolve_company_flexibly
from app.database import get_db
from app.models import Analysis, AnalysisJob, Company
from app.schemas.analysis import (
    AnalysisListItem,
    AnalysisStatusResponse,
    AnalysisSubmitResponse,
    PaginatedHistory,
)
from app.services import analysis_service, job_service, storage_service

router = APIRouter(prefix="/analysis", tags=["analysis"])


# ---------------------------------------------------------------------------
# Submit
# ---------------------------------------------------------------------------

@router.post("", response_model=AnalysisSubmitResponse, status_code=202)
def submit(
    db: Session = Depends(get_db),
    company: Company = Depends(current_company),
    file: UploadFile | None = File(default=None, alias="file"),
    image: UploadFile | None = File(default=None, alias="image"),
):
    """POST /analysis — multipart/form-data, image field named `file` OR `image`.

    Returns 202 the moment the analysis record + job are persisted; the request
    does NOT wait for AI inference. 409 when the company already has an active
    analysis, 422 when the file is invalid (type, contents, size, dimensions).
    Extra form fields (company_name, user_name, ...) are accepted and ignored.
    """
    upload = image or file
    if upload is None:
        raise HTTPException(
            status_code=422,
            detail={"error": "image_required", "message": "Send the advertisement as multipart field 'image'."},
        )
    return analysis_service.submit_analysis(db, company, upload=upload)


# ---------------------------------------------------------------------------
# History (registered BEFORE /{analysis_id} so "history" isn't matched as a UUID)
# ---------------------------------------------------------------------------

@router.get("/history", response_model=PaginatedHistory)
def history(
    page: int = 1,
    limit: int = 10,
    status: str | None = None,
    db: Session = Depends(get_db),
    company: Company = Depends(current_company),
):
    """GET /analysis/history — paginated company history, newest first."""
    page = max(1, min(page, 10_000))
    limit = max(1, min(limit, 50))

    clauses = [Analysis.company_id == company.id]
    if status in ("queued", "processing", "completed", "failed", "cancelled"):
        clauses.append(Analysis.status == status)

    total = db.scalar(select(func.count()).select_from(Analysis).where(*clauses)) or 0
    rows = db.scalars(
        select(Analysis)
        .where(*clauses)
        .order_by(Analysis.created_at.desc(), Analysis.id.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    ).all()

    items = []
    for row in rows:
        counts = {"violations_count": 0, "critical_count": 0, "major_count": 0, "minor_count": 0}
        report = row.report or {}
        violations = report.get("violations") if isinstance(report, dict) else []
        if isinstance(violations, list):
            counts["violations_count"] = len(violations)
            for v in violations:
                if isinstance(v, dict):
                    sev = v.get("severity")
                    if sev == "critical":
                        counts["critical_count"] += 1
                    elif sev == "major":
                        counts["major_count"] += 1
                    elif sev in ("minor", "info"):
                        counts["minor_count"] += 1

        items.append(
            AnalysisListItem.model_validate(
                {
                    "analysis_id": row.id,
                    "status": row.status,
                    "compliance_score": row.compliance_score,
                    "overall_status": row.overall_status,
                    "engine": row.engine,
                    "is_mock": row.is_mock,
                    "original_filename": row.original_filename,
                    "created_at": row.created_at,
                    "completed_at": row.completed_at,
                    "has_report": row.report is not None,
                    "image_url": f"/api/v1/analysis/{row.id}/image",
                    **counts,
                },
                from_attributes=False,
            )
        )

    return PaginatedHistory(
        items=items, total=total, page=page, limit=limit, pages=max(1, -(-total // limit))
    )


# ---------------------------------------------------------------------------
# Status / report
# ---------------------------------------------------------------------------

@router.get("/{analysis_id}/status", response_model=AnalysisStatusResponse)
def status(
    analysis_id: uuid.UUID,
    db: Session = Depends(get_db),
    company: Company = Depends(current_company),
):
    """GET /analysis/{analysis_id}/status — poll this while the job runs.

    When finished, the response also embeds the validated report under `result`
    so integrations can consume it straight from the poll result.
    """
    analysis = get_isolated_analysis(analysis_id, company, db)
    job = db.scalar(select(AnalysisJob).where(AnalysisJob.analysis_id == analysis.id))
    response = {
        "analysis_id": analysis.id,
        "status": job.status if job else analysis.status,
        "progress": job.progress if job else 0,
        "current_stage": job.current_stage if job else "",
        "stage": job.current_stage if job else "",
        "error": job.error if job else None,
    }
    if analysis.status == "completed" and analysis.report is not None:
        response["result"] = analysis.report
    return AnalysisStatusResponse(**response)


@router.get("/{analysis_id}")
def report(
    analysis_id: uuid.UUID,
    db: Session = Depends(get_db),
    company: Company = Depends(current_company),
):
    """GET /analysis/{analysis_id} — the complete report once completed.

    409 with `analysis_not_completed` while still queued/processing.
    """
    analysis = get_isolated_analysis(analysis_id, company, db)
    if analysis.status != "completed" or analysis.report is None:
        job = db.scalar(select(AnalysisJob).where(AnalysisJob.analysis_id == analysis.id))
        raise HTTPException(
            status_code=409,
            detail={
                "error": "analysis_not_completed",
                "message": f"Analysis is not finished yet (status: {analysis.status}).",
                "current_status": analysis.status,
                "progress": job.progress if job else 0,
                "current_stage": job.current_stage if job else "",
            },
        )
    return analysis.report


# ---------------------------------------------------------------------------
# Status / report
# ---------------------------------------------------------------------------


@router.post("/{analysis_id}/cancel")
def cancel(
    analysis_id: uuid.UUID,
    db: Session = Depends(get_db),
    company: Company = Depends(current_company),
):
    """POST /analysis/{analysis_id}/cancel — only pending analyses can cancel."""
    analysis = get_isolated_analysis(analysis_id, company, db)
    job = db.scalar(select(AnalysisJob).where(AnalysisJob.analysis_id == analysis.id))
    if job is None:
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Job not found."})
    if not job_service.cancel_job(db, company.id, job.id):
        raise HTTPException(
            status_code=409,
            detail={"error": "not_cancellable", "message": "Only queued analyses can be cancelled."},
        )
    return {"analysis_id": analysis.id, "status": "cancelled"}


@router.get("/{analysis_id}/image")
def image(
    analysis_id: uuid.UUID,
    request: Request,
    token: str | None = None,
    db: Session = Depends(get_db),
):
    """GET /analysis/{analysis_id}/image — the stored upload (authorised).

    Auth via `Authorization: Bearer` header OR `?token=` query parameter
    (needed because browsers cannot attach headers to <img> requests).
    """
    ctx = resolve_company_flexibly(request, token_query=token, db=db)
    analysis = get_isolated_analysis(analysis_id, ctx.company, db)
    path = storage_service.abs_path_for(analysis.image_path)
    if not path.is_file():
        raise HTTPException(status_code=404, detail={"error": "not_found", "message": "Image missing."})
    return FileResponse(path, media_type=f"image/{path.suffix[1:]}")
