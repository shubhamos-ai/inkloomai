"""Authentication / company-resolution dependencies.

Auth model for now (clearly marked dev mode — see README):
- `Authorization: Bearer <company_api_key>` where the key was handed out
  **once** during POST /onboarding. A browser-supplied company id is never
  proof of ownership.
- Until production tokens (JWT/OAuth sessions) exist, the shared DEV_AUTH_TOKEN
  from the environment may be used together with an `X-Company-ID` header for
  local integration only. DISABLE_DEV_AUTH=true removes this path.

The `resolve_context` interface stays identical for both modes, so dropping in
verified sessions/tokens later touches only this file.
"""
from __future__ import annotations

from dataclasses import dataclass

import uuid
from fastapi import Depends, HTTPException, Request
from app.database import select
from app.database import Session

from app.config import settings
from app.database import get_db, utcnow
from app.models import Analysis, BrandBrain, BrandRule, Company, User
from app.utils.security import hash_api_key

BEARER_PREFIX = "bearer "


class AuthContext:
    """The resolved caller context handed to every protected endpoint."""

    __slots__ = ("company", "company_id", "mode", "payload", "raw_token", "user")

    def __init__(self, company: Company | None, mode: str, payload: dict | None, raw_token: str | None = None, user=None):
        self.company = company
        self.company_id: uuid.UUID | None = company.id if company else None
        self.mode = mode            # "api_key" | "dev" | "session"
        self.payload = payload or {}
        self.raw_token = raw_token
        self.user = user            # User model instance (session mode only)


def bearer_token(request: Request) -> str | None:
    header = request.headers.get("authorization", "")
    if not header.lower().startswith(BEARER_PREFIX):
        return None
    return header[len(BEARER_PREFIX):].strip() or None


def _company_from_api_key(db: Session, token: str) -> Company | None:
    key_hash = hash_api_key(token)
    # Prefix column lets us short-circuit misses cheaply.
    prefix = token[:10]
    company = db.scalar(
        select(Company).where(Company.api_key_hash == key_hash, Company.api_key_prefix == prefix)
    )
    return company


def _dev_company_or_401(request: Request, db: Session, token: str) -> Company:
    company_id = (request.headers.get("x-company-id") or "").strip()
    if not company_id:
        raise HTTPException(
            status_code=401,
            detail={
                "error": "company_id_required",
                "message": "DEV AUTH: send X-Company-ID alongside the development token.",
            },
        )
    try:
        cid = uuid.UUID(company_id)
    except ValueError:
        raise HTTPException(
            status_code=401,
            detail={"error": "invalid_company_id", "message": "X-Company-ID is not a valid company id."},
        )
    company = db.get(Company, cid)
    if not company:
        raise HTTPException(
            status_code=401, detail={"error": "unknown_company", "message": "Unknown company id."}
        )
    return company


def resolve_context(
    request: Request, db: Session = Depends(get_db)
) -> AuthContext:
    """Resolve a caller to a company. Raises 401 when nothing authenticates."""
    token = bearer_token(request)
    if not token:
        raise HTTPException(
            status_code=401,
            detail={
                "error": "missing_auth",
                "message": "Send 'Authorization: Bearer <token>'. Get one via POST /api/v1/onboarding.",
            },
        )
    return _resolve_context_for_token(request, db, token)


def _company_from_session(db: Session, request: Request, user) -> Company | None:
    """Pick the session user's active company: X-Company-ID (validated for
    ownership) or their first-created company. Raises 401 on foreign company."""
    company_id = (request.headers.get("x-company-id") or "").strip()
    owned = db.scalars(
        select(Company).where(Company.owner_user_id == user.id).order_by(Company.created_at)
    ).all()
    if company_id:
        try:
            cid = uuid.UUID(company_id)
        except ValueError:
            raise HTTPException(
                status_code=401,
                detail={"error": "invalid_company_id", "message": "X-Company-ID is not a valid company id."},
            )
        company = next((c for c in owned if str(c.id) == str(cid)), None)
        if company is None:
            raise HTTPException(
                status_code=401,
                detail={
                    "error": "company_forbidden",
                    "message": "That company does not belong to this account.",
                },
            )
        return company
    return owned[0] if owned else None


def _resolve_context_for_token(request: Request, db: Session, token: str) -> AuthContext:
    user = _user_from_session_token(db, token)
    if user is not None:
        company = _company_from_session(db, request, user)
        return AuthContext(
            company=company, mode="session", payload={"session": True}, raw_token=token, user=user
        )

    company = _company_from_api_key(db, token)
    if company:
        return AuthContext(company=company, mode="api_key", payload={}, raw_token=token)

    if settings.DEV_AUTH_TOKEN and token == settings.DEV_AUTH_TOKEN and not settings.DISABLE_DEV_AUTH:
        company = _dev_company_or_401(request, db, token)
        return AuthContext(company=company, mode="dev", payload={"dev": True}, raw_token=token)

    raise HTTPException(
        status_code=401,
        detail={"error": "invalid_token", "message": "The provided token is not valid."},
    )


def _user_from_session_token(db: Session, token: str):
    from datetime import timedelta

    from app.models import AuthSession

    if not token.startswith("il_sess_"):
        return None
    session = db.scalar(select(AuthSession).where(AuthSession.token_hash == hash_api_key(token)))
    if session is None:
        return None
    expiry = session.expires_at
    if expiry.tzinfo is not None:
        expiry = (expiry - timedelta(hours=0)).replace(tzinfo=None)
    if expiry < utcnow():
        raise HTTPException(
            status_code=401,
            detail={
                "error": "session_expired",
                "message": "Your session expired. Please sign in again.",
            },
        )
    return session.user


def resolve_company_flexibly(
    request: Request,
    token_query: str | None = None,
    db: Session = None,
) -> AuthContext:
    """Auth for asset endpoints the browser fetches directly (e.g. <img> tags).

    Accepts the token either in the Authorization header or in a `token` query
    parameter — the query path is needed because browsers cannot send custom
    headers on plain image requests. Keep query-token usage app-internal.
    """
    token = bearer_token(request) or token_query
    if not token:
        raise HTTPException(
            status_code=401,
            detail={"error": "missing_auth", "message": "Missing authentication token."},
        )
    return _resolve_context_for_token(request, db, token)


def current_company(ctx: AuthContext = Depends(resolve_context)) -> Company:
    if ctx.company is None:
        raise HTTPException(
            status_code=401,
            detail={
                "error": "company_required",
                "message": "Create or choose a company first (POST /api/v1/onboarding).",
            },
        )
    return ctx.company


# ---------------------------------------------------------------------------
# Company-isolated object fetchers (never leak other companies' data)
# ---------------------------------------------------------------------------

def get_isolated_brain(brain_id: uuid.UUID, company: Company, db: Session) -> BrandBrain:
    brain = db.get(BrandBrain, brain_id)
    if brain is None or str(brain.company_id) != str(company.id):
        raise HTTPException(
            status_code=404,
            detail={"error": "not_found", "message": "Resource not found."},
        )
    return brain


def get_isolated_rule(rule_id: uuid.UUID, company: Company, db: Session) -> BrandRule:
    rule = db.get(BrandRule, rule_id)
    if rule is None or str(rule.company_id) != str(company.id):
        raise HTTPException(
            status_code=404,
            detail={"error": "not_found", "message": "Resource not found."},
        )
    return rule


def get_isolated_analysis(analysis_id: uuid.UUID, company: Company, db: Session) -> Analysis:
    analysis = db.get(Analysis, analysis_id)
    if analysis is None or str(analysis.company_id) != str(company.id):
        raise HTTPException(
            status_code=404,
            detail={"error": "not_found", "message": "Resource not found."},
        )
    return analysis
