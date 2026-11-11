"""/auth — user accounts with email + password (Netflix-style onboarding).

Tokens are opaque random values; the server stores only their SHA-256 hash
with a server-side expiry. Every protected endpoint already accepts these
tokens through resolve_context, which resolves the caller's company(s).
"""
from __future__ import annotations

import secrets
import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import AuthContext, resolve_context
from app.config import settings
from app.database import get_db, utcnow
from app.models import AuthSession, Company, Analysis, User
from app.schemas.auth import (
    AuthSessionResponse,
    CompanySummary,
    LoginRequest,
    MeResponse,
    RegisterRequest,
    UpdateMeRequest,
    UserOut,
)
from app.utils.security import (
    hash_api_key,
    hash_password,
    new_session_token,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])

SESSION_LIFETIME = timedelta(days=settings.SESSION_LIFETIME_DAYS)
CSRF_COOKIE_MAX_AGE = int(SESSION_LIFETIME.total_seconds())


def _create_session(db: Session, user: User) -> str:
    token = new_session_token()
    db.add(
        AuthSession(
            user_id=user.id,
            token_hash=hash_api_key(token),
            expires_at=utcnow() + SESSION_LIFETIME,
        )
    )
    db.commit()
    return token


def _cookie_kwargs() -> dict:
    kwargs = {
        "secure": settings.COOKIE_SECURE,
        "samesite": settings.COOKIE_SAMESITE,
        "path": "/",
    }
    if settings.COOKIE_DOMAIN:
        kwargs["domain"] = settings.COOKIE_DOMAIN
    return kwargs


def _set_auth_cookies(response: Response, token: str) -> str:
    """Set the HttpOnly session cookie + readable double-submit CSRF cookie."""
    csrf = secrets.token_urlsafe(32)
    kwargs = _cookie_kwargs()
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=token,
        max_age=CSRF_COOKIE_MAX_AGE,
        httponly=True,
        **kwargs,
    )
    response.set_cookie(
        key=settings.CSRF_COOKIE_NAME,
        value=csrf,
        max_age=CSRF_COOKIE_MAX_AGE,
        httponly=False,
        **kwargs,
    )
    return csrf


def _clear_auth_cookies(response: Response) -> None:
    kwargs = _cookie_kwargs()
    response.delete_cookie(settings.SESSION_COOKIE_NAME, **kwargs)
    response.delete_cookie(settings.CSRF_COOKIE_NAME, **kwargs)


@router.post("/register", response_model=AuthSessionResponse, status_code=201)
def register(
    payload: RegisterRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthSessionResponse:
    """Register a new user account. Sets session cookies and returns the token."""
    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail={
                "error": "email_taken",
                "message": "An account with this email already exists. Sign in instead.",
            },
        )

    user = User(
        name=payload.name or payload.email.rsplit("@", 1)[0],
        email=payload.email,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = _create_session(db, user)
    _set_auth_cookies(response, token)
    return AuthSessionResponse(
        user_id=user.id, session_token=token, name=user.name, has_company=False,
        message="Account created. Next: add or choose your company.",
    )


@router.post("/login", response_model=AuthSessionResponse)
def login(
    payload: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthSessionResponse:
    """Email + password sign-in. Sets session cookies, generic errors."""
    user = db.scalar(select(User).where(User.email == payload.email))
    if user is None or not user.password_hash or not verify_password(
        payload.password, user.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail={
                "error": "invalid_credentials",
                "message": "Incorrect email or password.",
            },
        )

    token = _create_session(db, user)
    _set_auth_cookies(response, token)
    has_company = db.scalar(
        select(func.count()).select_from(Company).where(Company.owner_user_id == user.id)
    ) or 0
    return AuthSessionResponse(
        user_id=user.id,
        session_token=token,
        name=user.name,
        has_company=bool(has_company),
        message="Signed in.",
    )


@router.get("/me", response_model=MeResponse)
def me(ctx: AuthContext = Depends(resolve_context), db: Session = Depends(get_db)):
    """Current user + their companies (for the 'choose company' step)."""
    user = ctx.user
    rows = db.scalars(
        select(Company).where(Company.owner_user_id == user.id).order_by(Company.created_at)
    ).all()

    companies = []
    for c in rows:
        stats = db.execute(
            select(func.count(), func.avg(Analysis.compliance_score))
            .select_from(Analysis)
            .where(Analysis.company_id == c.id, Analysis.status == "completed")
        ).one()
        count = stats[0] or 0
        avg = round(stats[1]) if stats[1] is not None else None
        companies.append(
            CompanySummary(
                id=c.id,
                company_name=c.company_name,
                industry=c.industry,
                website=c.website,
                created_at=c.created_at,
                analysis_count=count,
                compliance_score=avg,
            )
        )

    return MeResponse(user=UserOut.model_validate(user), companies=companies)


@router.patch("/me", response_model=MeResponse)
def update_me(
    payload: UpdateMeRequest,
    request_user: AuthContext = Depends(resolve_context),
    db: Session = Depends(get_db),
):
    """Update the user's name (wizard step 2)."""
    db_user = db.get(User, request_user.user.id)
    if db_user is None:  # pragma: no cover
        raise HTTPException(status_code=401, detail={"error": "invalid_token", "message": "Session not found."})
    db_user.name = payload.name
    db.commit()
    await_me = me(request_user, db)  # type: ignore[arg-type]
    return await_me


@router.post("/logout")
def logout(
    response: Response,
    ctx: AuthContext = Depends(resolve_context),
    db: Session = Depends(get_db),
):
    """Invalidate the current session and clear the browser cookies."""
    token = ctx.raw_token
    if token:
        session = db.scalar(select(AuthSession).where(AuthSession.token_hash == hash_api_key(token)))
        if session:
            db.delete(session)
            db.commit()
    _clear_auth_cookies(response)
    return {"ok": True}
