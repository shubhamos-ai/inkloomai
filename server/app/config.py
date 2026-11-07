"""
Inkloom AI — application configuration.

All secrets and environment-specific values come from environment variables.
Copy `server/.env.example` to `server/.env` and adjust for your machine.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

# Base directory = server/ (parent of app/)
BASE_DIR = Path(__file__).resolve().parent.parent

# Load server/.env if present (never committed).
load_dotenv(BASE_DIR / ".env")


def _env_list(name: str, default: str = "") -> list[str]:
    raw = os.getenv(name, default).strip()
    if not raw:
        return []
    return [item.strip() for item in raw.split(",") if item.strip()]


class Settings:
    """Runtime settings. Values marked DEV/INSECURE must never reach production."""

    APP_NAME: str = "Inkloom AI"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"

    # ------------------------------------------------------------------
    # Database (MongoDB Local Self-Hosted)
    # ------------------------------------------------------------------
    DATABASE_URL: str = os.getenv("DATABASE_URL", "mongodb://127.0.0.1:27017/inkloom")
    MONGODB_DB_NAME: str = os.getenv("MONGODB_DB_NAME", "inkloom")

    # ------------------------------------------------------------------
    # NVIDIA NIM Vision API (Production Multimodal Vision Engine)
    # ------------------------------------------------------------------
    VISION_PROVIDER: str = os.getenv("VISION_PROVIDER", "nvidia_nim")
    NVIDIA_API_KEY: str = os.getenv("NVIDIA_API_KEY", "")
    NVIDIA_BASE_URL: str = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
    NVIDIA_VISION_MODEL: str = os.getenv("NVIDIA_VISION_MODEL", "nvidia/nemotron-3.5-super-vl-120b-a12b")
    NVIDIA_TIMEOUT_SECONDS: float = float(os.getenv("NVIDIA_TIMEOUT_SECONDS", "90"))

    # ------------------------------------------------------------------
    # Storage
    # ------------------------------------------------------------------
    STORAGE_DIR: Path = Path(os.getenv("STORAGE_DIR", str(BASE_DIR / "storage")))
    MAX_UPLOAD_SIZE_MB: int = int(os.getenv("MAX_UPLOAD_SIZE_MB", "15"))
    MIN_IMAGE_DIMENSION: int = int(os.getenv("MIN_IMAGE_DIMENSION", "64"))
    MAX_IMAGE_DIMENSION: int = int(os.getenv("MAX_IMAGE_DIMENSION", "8000"))

    # ------------------------------------------------------------------
    # Security / auth
    # ------------------------------------------------------------------
    CORS_ORIGINS: list[str] = _env_list(
        "CORS_ORIGINS", "https://inkoom-ai.shubhamos.com"
    )
    CORS_EXTRA_ORIGINS: list[str] = _env_list("CORS_EXTRA_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")

    API_PREFIX: str = "/api/v1"

    DEV_AUTH_TOKEN: str = os.getenv("DEV_AUTH_TOKEN", "")
    DISABLE_DEV_AUTH: bool = os.getenv("DISABLE_DEV_AUTH", "false").lower() == "true"

    RATE_LIMIT_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "120"))

    # ------------------------------------------------------------------
    # Ollama (local fallback / dev only)
    # ------------------------------------------------------------------
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
    OLLAMA_VISION_MODEL: str = os.getenv("OLLAMA_VISION_MODEL", "")
    OLLAMA_TIMEOUT_SECONDS: float = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "300"))

    # ------------------------------------------------------------------
    # Analysis pipeline
    # ------------------------------------------------------------------
    PIPELINE_MODE: str = os.getenv("PIPELINE_MODE", "ai")

    # ------------------------------------------------------------------
    # Worker / job queue
    # ------------------------------------------------------------------
    WORKER_POLL_INTERVAL_SECONDS: float = float(os.getenv("WORKER_POLL_INTERVAL_SECONDS", "1.0"))
    STALE_JOB_AFTER_SECONDS: float = float(os.getenv("STALE_JOB_AFTER_SECONDS", "300"))
    MAX_JOB_ATTEMPTS: int = int(os.getenv("MAX_JOB_ATTEMPTS", "3"))
    # Run the analysis job loop inside the API process (Render.com — a standalone
    # worker service cannot share the web service's filesystem).
    RUN_EMBEDDED_WORKER: bool = os.getenv("RUN_EMBEDDED_WORKER", "false").lower() == "true"

    @property
    def all_origins(self) -> list[str]:
        return self.CORS_ORIGINS + self.CORS_EXTRA_ORIGINS

    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()


def ensure_storage_dirs() -> None:
    for sub in ("uploads", "brand_guidelines", "reports"):
        (settings.STORAGE_DIR / sub).mkdir(parents=True, exist_ok=True)
