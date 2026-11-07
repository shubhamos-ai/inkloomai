"""Session-based authentication endpoints.

Email/password register and login, password hashing with passlib/bcrypt, and
session tokens stored in `auth_sessions`.
"""
from __future__ import annotations

import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from app.database import func, select
from app.database import Session

from app.api.deps import AuthContext, resolve_context
from app.config import settings
from app.database import get_db, utcnow
from app.models import Analysis, AuthSession, Company, User
from app.utils.security import new_session_token, hash_api_key, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

SESSION_TTL_DAYS = 30


class RegisterRequest(BaseModel):
    name: str = Field(default="", max_length=120)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class UpdateMeRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)


class UserOut(BaseModel):
    id: uuid.UUID
    name: str
    email: str | None
    created_at: object

    class Config:
        from_attributes = True


class CompanySummary(BaseModel):
    id: uuid.UUID
    company_name: str
    industry: str | None
    website: str | None
    created_at: object
    analysis_count: int
    compliance_score: int | None


class AuthSessionResponse(BaseModel):
    user_id: uuid.UUID
    session_token: str
    name: str
    has_company: bool
    message: str


class MeResponse(BaseModel):
    user: UserOut
    companies: list[CompanySummary]


def _issue_session(db: Session, user: User, user_agent: str | None = None, ip: str | None = None) -> str:
    raw_token = new_session_token()
    token_hash = hash_api_key(raw_token)
    session = AuthSession(
        user_id=user.id,
        token_hash=token_hash,
        user_agent=(user_agent or "")[:255] or None,
        ip_address=(ip or "")[:45] or None,
        expires_at=utcnow() + timedelta(days=SESSION_TTL_DAYS),
    )
    db.add(session)
    db.commit()
    return raw_token


@router.post("/register", response_model=AuthSessionResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    """Create a new user account with email + password."""
    existing = db.scalar(select(User).where(User.email == payload.email.lower()))
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": "email_taken", "message": "An account with that email already exists."},
        )
    user_name = payload.name.strip() if payload.name else payload.email.split("@")[0]
    user = User(
        name=user_name,
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    token = _issue_session(db, user)
    return AuthSessionResponse(
        user_id=user.id,
        session_token=token,
        name=user.name,
        has_company=False,
        message="Account created successfully.",
    )


@router.post("/login", response_model=AuthSessionResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """Sign in with email + password."""
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "invalid_credentials", "message": "Incorrect email or password."},
        )
    token = _issue_session(db, user)
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
    request_user.user = db_user
    db.commit()
    await_me = me(request_user, db)  # type: ignore[arg-type]
    return await_me


@router.post("/logout")
def logout(ctx: AuthContext = Depends(resolve_context), db: Session = Depends(get_db)):
    """Invalidate the current session (requires the token to be valid)."""
    token = ctx.raw_token
    if token:
        session = db.scalar(select(AuthSession).where(AuthSession.token_hash == hash_api_key(token)))
        if session:
            db.delete(session)
            db.commit()
    return {"ok": True}
