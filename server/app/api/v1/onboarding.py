"""POST /onboarding — user + company creation, hands out the company API key."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import AuthContext, bearer_token, resolve_context
from app.database import get_db
from app.models import Company, User
from app.schemas.onboarding import OnboardingRequest, OnboardingResponse
from app.utils.security import generate_api_key, hash_api_key, key_prefix_of
from app.config import settings

router = APIRouter(tags=["onboarding"])


@router.post("/onboarding", response_model=OnboardingResponse)
def onboard(payload: OnboardingRequest, db: Session = Depends(get_db)):
    """Create a user + company. Returns ids and a one-time company access token.

    In DEV AUTH mode the token is the company's own API key (never share it).
    Production will move this to verified sessions/tokens with the same
    response shape so the frontend migration is a one-line change.
    """
    # Prevent duplicate naive accounts sharing the same email.
    if payload.email:
        existing_user = db.scalar(select(User).where(User.email == payload.email))
        if existing_user:
            existing_company = db.scalar(
                select(Company).where(Company.owner_user_id == existing_user.id)
            )
            if existing_company:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "error": "already_onboarded",
                        "message": "A company is already registered with this email.",
                    },
                )

    user = User(name=payload.name, email=payload.email)
    db.add(user)
    db.flush()

    api_key = generate_api_key()
    company = Company(
        company_name=payload.company_name,
        industry=payload.industry,
        website=str(payload.website) if payload.website else None,
        owner_user_id=user.id,
        api_key_hash=hash_api_key(api_key),
        api_key_prefix=key_prefix_of(api_key),
    )
    db.add(company)
    db.commit()

    auth_mode = "dev"
    if settings.DISABLE_DEV_AUTH:
        auth_mode = "api_key"

    return OnboardingResponse(
        user_id=user.id,
        company_id=company.id,
        access_token=api_key,
        token_type="bearer",
        auth_mode=auth_mode,
        message="Store the access token now — it is shown only once.",
    )


@router.get("/onboarding/check")
def onboard_check(ctx: AuthContext = Depends(resolve_context)):
    """Sanity check: 'am I authenticated?' — used by the frontend after saving the token."""
    return {
        "authenticated": True,
        "auth_mode": ctx.mode,
        "company_id": ctx.company_id,
        "company_name": ctx.company.company_name,
    }
