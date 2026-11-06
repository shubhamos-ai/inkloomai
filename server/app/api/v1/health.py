"""GET /health — the one endpoint that must answer even if AI services are down."""
from __future__ import annotations

from fastapi import APIRouter

from app.config import settings
from app.database import db_ready, utcnow
from app.services.ollama_service import check_status as check_ollama
from app.services.nim_vision_service import check_status as check_nvidia

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    # Check all vision providers
    providers = {}

    # Check Ollama (local dev)
    try:
        ollama = check_ollama()
        providers["ollama"] = {
            "status": ollama["status"],
            "available": ollama.get("available", False),
            "model": ollama.get("vision_model"),
        }
    except Exception:  # noqa: BLE001 — health must NEVER 500
        providers["ollama"] = {"status": "offline", "available": False}

    # Check NVIDIA NIM (production)
    try:
        nvidia = check_nvidia()
        providers["nvidia_nim"] = {
            "status": nvidia["status"],
            "available": nvidia.get("available", False),
            "model": nvidia.get("vision_model"),
        }
    except Exception:  # noqa: BLE001
        providers["nvidia_nim"] = {"status": "offline", "available": False}

    # Determine active provider
    if settings.use_nvidia_nim:
        active_provider = "nvidia_nim"
        active_status = providers.get("nvidia_nim", {}).get("status", "unknown")
    elif settings.use_ollama:
        active_provider = "ollama"
        active_status = providers.get("ollama", {}).get("status", "unknown")
    else:
        active_provider = "mock"
        active_status = "ready"

    return {
        "status": "online",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "database": "connected" if db_ready() else "disconnected",
        "vision_provider": active_provider,
        "vision_status": active_status,
        "pipeline_mode": settings.PIPELINE_MODE,
        "providers": providers,
        "time": utcnow().isoformat() + "Z",
    }