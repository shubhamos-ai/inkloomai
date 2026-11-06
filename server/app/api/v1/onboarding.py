"""POST /onboarding — user + company creation, hands out the company API key."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi import Request as FastAPIRequest
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
async def onboard(
    payload: OnboardingRequest,
    request: FastAPIRequest,
    db: Session = Depends(get_db),
):
    """Create a company (and, in legacy mode, the user too).

    Two modes:
    - Session Bearer token (Netflix-style wizard): the logged-in user adds
      *another* company; the company is linked to their account.
    - No session (legacy dev mode): creates a user from `name`/`email` and the
      company; hands out the one-time company API key.
    """
    # Blocklist duplicate naive accounts sharing the same email (legacy mode
    # only — session users may own multiple companies).
    from app.api.deps import _user_from_session_token

    session_user = _user_from_session_token(db, bearer_token(request) or "")
    if session_user is not None:
        user = session_user
    else:
        user = None
        if payload.email:
            user = db.scalar(select(User).where(User.email == payload.email))

    api_key = generate_api_key()

    if user is None:
        user = User(
            name=payload.name,
            email=payload.email,
        )
        db.add(user)
        db.flush()

    company = Company(
        company_name=payload.company_name,
        industry=payload.industry,
        website=str(payload.website) if payload.website else None,
        owner_user_id=user.id,
        api_key_hash=hash_api_key(api_key),
        api_key_prefix=key_prefix_of(api_key),
    )
    db.add(company)

    # Touch the stored name when the wizard renamed the account along the way.
    if session_user is not None and payload.name and payload.name != user.name:
        user.name = payload.name

    db.commit()

    auth_mode = "session" if session_user is not None else ("dev" if not settings.DISABLE_DEV_AUTH else "api_key")

    return OnboardingResponse(
        user_id=user.id,
        company_id=company.id,
        access_token=api_key,
        token_type="bearer",
        auth_mode=auth_mode,
        message="Company created. Store the access token now — it is shown only once.",
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
