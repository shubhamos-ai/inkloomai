"""API endpoint for fast ad compliance verification."""
from __future__ import annotations

from fastapi import APIRouter
from app.schemas.verify import VerifyAdRequest, VerifyAdResponse
from app.engine.verify_ad import verify_ad_compliance

router = APIRouter(tags=["verification"])


@router.post("/verify-ad", response_model=VerifyAdResponse)
def verify_ad_endpoint(payload: VerifyAdRequest) -> VerifyAdResponse:
    """Verify an advertisement against rules, discount ceilings, and disclosures."""
    result = verify_ad_compliance(
        company_name=payload.company_name,
        rules=payload.rules,
        ad_headline=payload.ad_headline,
        ad_copy=payload.ad_copy,
        media_metrics=payload.media_metrics,
        text_metrics=payload.text_metrics,
    )
    return VerifyAdResponse(**result)
