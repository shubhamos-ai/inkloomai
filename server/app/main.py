"""Inkloom AI FastAPI application.

Local dev:   http://127.0.0.1:8000   (bound to localhost only)
Tunnel:      https://inkoom-model.shubhamos.com  (Cloudflare Tunnel provides
             connectivity only — auth lives in this app: api/deps.py)
"""
from __future__ import annotations

import traceback

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.responses import JSONResponse

from app.config import ensure_storage_dirs, settings
from app.utils.rate_limiter import RateLimitMiddleware

ensure_storage_dirs()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "AI-powered advertising compliance and brand-governance platform.\n\n"
        "Auth model (DEV): `Authorization: Bearer <company_api_key>` from POST /onboarding.\n"
        "Production will use verified sessions/tokens — the dependency interface is identical."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# ---------------------------------------------------------------- CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.all_origins,
    allow_credentials=False,  # Bearer tokens, not cookies — keep CORS strict
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Company-ID", "X-API-Key"],
    expose_headers=["X-RateLimit-Limit", "X-RateLimit-Remaining", "Retry-After"],
)
# Gzip compresses report/history JSON payloads nicely.
app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(
    RateLimitMiddleware,
    limit=settings.RATE_LIMIT_PER_MINUTE,
    window_seconds=60,
    exempt_paths=("/api/v1/health", "/docs", "/redoc", "/openapi.json", "/"),
)

# ---------------------------------------------------------------- routers
from app.api.v1 import analysis, auth, brand_brain, dashboard, health, onboarding, verify  # noqa: E402

app.include_router(health.router, prefix=settings.API_PREFIX)
app.include_router(auth.router, prefix=settings.API_PREFIX)
app.include_router(onboarding.router, prefix=settings.API_PREFIX)
app.include_router(brand_brain.router, prefix=settings.API_PREFIX)
app.include_router(analysis.router, prefix=settings.API_PREFIX)
app.include_router(dashboard.router, prefix=settings.API_PREFIX)
app.include_router(verify.router, prefix="/api")
app.include_router(verify.router, prefix=settings.API_PREFIX)


# ---------------------------------------------------------------- error format
def _error_body(request: Request, code: str, message: str, status_code: int) -> JSONResponse:
    """Uniform error envelope. Never leaks filesystem paths when DEBUG=false."""
    body = {"error": code, "message": message}
    if settings.DEBUG:
        body["detail"] = None
    return JSONResponse(status_code=status_code, content={"detail": body})


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    detail = exc.detail
    if isinstance(detail, dict):
        payload = {"detail": detail}
    else:
        payload = {"detail": {"error": "error", "message": str(detail)}}
    return JSONResponse(status_code=exc.status_code, content=payload, headers=exc.headers)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Keep the response generic in production: no stack traces, no internals.
    body = {
        "error": "validation_error",
        "message": "The request payload failed validation.",
        "fields": [
            {"field": ".".join(str(loc) for loc in err.get("loc", [])), "issue": err.get("msg", "")}
            for err in exc.errors()
        ],
    }
    if not settings.DEBUG:
        body.pop("fields", None)
    return JSONResponse(status_code=422, content={"detail": body})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Log server-side, return a safe generic error to the client.
    current = traceback.format_exc()
    print(f"[inkloom] unhandled error on {request.method} {request.url.path}:\n{current}")
    return _error_body(
        request,
        "internal_error",
        "Something went wrong on our side. Please try again shortly.",
        500,
    )


@app.get("/")
def root():
    return {
        "service": settings.APP_NAME,
        "status": "online",
        "docs": "/docs",
        "api": settings.API_PREFIX,
    }


@app.on_event("startup")
def _start_background_services() -> None:
    # Render.com: process the analysis queue inside the web service.
    from app.embedded_worker import start_embedded_worker

    start_embedded_worker()
