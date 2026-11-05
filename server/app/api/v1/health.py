"""GET /health — the one endpoint that must answer even if Ollama is down."""
from __future__ import annotations

from fastapi import APIRouter

from app.config import settings
from app.database import db_ready, utcnow
from app.services.ollama_service import check_status

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    try:
        ollama = check_status()
    except Exception:  # noqa: BLE001 — health must NEVER 500 because of Ollama
        ollama = {"status": "offline", "vision_model": settings.OLLAMA_VISION_MODEL}

    return {
        "status": "online",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "database": "connected" if db_ready() else "disconnected",
        "ollama_status": ollama["status"],
        "vision_model": ollama.get("vision_model"),
        "pipeline_mode": settings.PIPELINE_MODE,
        "time": utcnow().isoformat() + "Z",
    }
