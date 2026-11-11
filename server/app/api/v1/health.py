"""GET /health — the one endpoint that must answer even if AI services are down.

The default response is intentionally *fast*: it only checks the database and
reports the configured provider without making outbound HTTP calls. Render's
health check and the frontend's "is the backend awake?" ping must never block
on a slow AI provider, otherwise a healthy backend looks offline.

Use `GET /health?deep=true` for provider reachability probes (ops only).
"""
from __future__ import annotations

from fastapi import APIRouter

from app.config import settings
from app.database import db_ready, utcnow

router = APIRouter(tags=["health"])


def _configured_provider() -> tuple[str, str]:
    """(provider, status) resolved from configuration only — no network I/O."""
    if settings.use_nvidia_nim:
        return "nvidia_nim", "configured"
    if settings.use_ollama:
        return "ollama", "configured"
    if settings.use_mock:
        return "mock", "ready"
    return "none", "not_configured"


@router.get("/health")
def health(deep: bool = False):
    provider, provider_status = _configured_provider()
    payload = {
        "status": "online",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "database": "connected" if db_ready() else "disconnected",
        "vision_provider": provider,
        "vision_status": provider_status,
        "pipeline_mode": settings.PIPELINE_MODE,
        "storage_backend": settings.storage_backend_name,
        "worker": "embedded" if settings.run_embedded_worker else "dedicated",
        "time": utcnow().isoformat() + "Z",
    }

    if not deep:
        return payload

    # ---- deep probe (ops only; can take several seconds) --------------------
    providers: dict[str, dict] = {}

    try:
        from app.services.ollama_service import check_status as check_ollama

        ollama = check_ollama()
        providers["ollama"] = {
            "status": ollama["status"],
            "available": ollama.get("available", False),
            "model": ollama.get("vision_model"),
        }
    except Exception:  # noqa: BLE001 — health must NEVER 500
        providers["ollama"] = {"status": "offline", "available": False}

    try:
        from app.services.nim_vision_service import check_status as check_nvidia

        nvidia = check_nvidia()
        providers["nvidia_nim"] = {
            "status": nvidia["status"],
            "available": nvidia.get("available", False),
            "model": nvidia.get("vision_model"),
        }
    except Exception:  # noqa: BLE001
        providers["nvidia_nim"] = {"status": "offline", "available": False}

    payload["providers"] = providers
    if provider == "nvidia_nim":
        payload["vision_status"] = providers["nvidia_nim"]["status"]
    elif provider == "ollama":
        payload["vision_status"] = providers["ollama"]["status"]
    return payload
