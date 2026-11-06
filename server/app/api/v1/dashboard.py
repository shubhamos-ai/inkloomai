"""GET /dashboard — aggregated company statistics for the dashboard UI."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import current_company
from app.database import get_db
from app.models import Analysis, Company

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard")
def dashboard_stats(db: Session = Depends(get_db), company: Company = Depends(current_company)):
    rows = db.scalars(
        select(Analysis).where(Analysis.company_id == company.id).order_by(Analysis.created_at)
    ).all()

    completed = [r for r in rows if r.status == "completed"]
    scored = [r for r in completed if r.compliance_score is not None]
    total = len(rows)
    average = round(sum(r.compliance_score for r in scored) / len(scored)) if scored else None
    needs_attention = sum(
        1 for r in scored if r.overall_status in ("needs_revision", "critical_failure")
    )
    fully_compliant = sum(1 for r in scored if r.overall_status == "passed")

    return {
        "total_analyses": total,
        "average_compliance_score": average,
        "needs_attention": needs_attention,
        "fully_compliant": fully_compliant,
        "completed": len(completed),
        "in_progress": sum(1 for r in rows if r.status in ("queued", "processing")),
        "failed": sum(1 for r in rows if r.status == "failed"),
    }
