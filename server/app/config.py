"""
Inkloom AI — application configuration.

All secrets and environment-specific values come from environment variables.
Copy `server/.env.example` to `server/.env` and never commit .env files.
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
    # Database
    # ------------------------------------------------------------------
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'data' / 'inkloom.db'}")

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
        "CORS_ORIGINS",
        "https://inkloom-ai.shubhamos.com,https://inkoom-ai.shubhamos.com",
    )
    CORS_EXTRA_ORIGINS: list[str] = _env_list("CORS_EXTRA_ORIGINS", "")
    # Render.com injects RENDER_EXTERNAL_URL for the backend service itself.
    # We also accept the frontend's Render URL from RENDER_FRONTEND_URL.
    RENDER_EXTERNAL_URL: str = os.getenv("RENDER_EXTERNAL_URL", "")
    RENDER_FRONTEND_URL: str = os.getenv("RENDER_FRONTEND_URL", "")

    API_PREFIX: str = "/api/v1"

    DEV_AUTH_TOKEN: str = os.getenv("DEV_AUTH_TOKEN", "")
    DISABLE_DEV_AUTH: bool = os.getenv("DISABLE_DEV_AUTH", "false").lower() == "true"

    RATE_LIMIT_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "120"))

    # ------------------------------------------------------------------
    # AI Vision Provider Selection
    # ------------------------------------------------------------------
    # Options: "nvidia_nim" (production), "ollama" (local dev), "mock" (testing)
    VISION_PROVIDER: str = os.getenv("VISION_PROVIDER", "nvidia_nim")

    # ------------------------------------------------------------------
    # NVIDIA NIM (production - deployable on Render.com)
    # Get your API key from: https://build.nvidia.com/meta/llama-3.2-11b-vision-instruct
    # Example: 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
    # ------------------------------------------------------------------
    NVIDIA_API_KEY: str = os.getenv("NVIDIA_API_KEY", "")
    # Vision model served via https://integrate.api.nvidia.com/v1 (OpenAI-compatible).
    # NOTE: `llama-3.2-11b-vision-instruct` reached end-of-life on 2026-11-05.
    NVIDIA_VISION_MODEL: str = os.getenv("NVIDIA_VISION_MODEL", "meta/llama-3.2-90b-vision-instruct")

    # ------------------------------------------------------------------
    # Ollama (local development only - NOT for production)
    # ------------------------------------------------------------------
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
    OLLAMA_VISION_MODEL: str = os.getenv("OLLAMA_VISION_MODEL", "")
    OLLAMA_TIMEOUT_SECONDS: float = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "300"))

    # ------------------------------------------------------------------
    # Analysis pipeline
    # ------------------------------------------------------------------
    # "mock"  -> infrastructure test pipeline (clearly labelled mock output)
    # "ai"    -> real inference via configured VISION_PROVIDER
    PIPELINE_MODE: str = os.getenv("PIPELINE_MODE", "ai")

    # ------------------------------------------------------------------
    # Worker / job queue
    # ------------------------------------------------------------------
    WORKER_POLL_INTERVAL_SECONDS: float = float(os.getenv("WORKER_POLL_INTERVAL_SECONDS", "1.0"))
    STALE_JOB_AFTER_SECONDS: float = float(os.getenv("STALE_JOB_AFTER_SECONDS", "300"))
    MAX_JOB_ATTEMPTS: int = int(os.getenv("MAX_JOB_ATTEMPTS", "3"))
    # Run the analysis job loop inside the API process (Render.com — a standalone
    # worker service cannot share the web service's persistent disk).
    RUN_EMBEDDED_WORKER: bool = os.getenv("RUN_EMBEDDED_WORKER", "false").lower() == "true"

    @property
    def all_origins(self) -> list[str]:
        origins = list(self.CORS_ORIGINS) + list(self.CORS_EXTRA_ORIGINS)
        # Auto-include Render's frontend URL when set
        if self.RENDER_FRONTEND_URL and self.RENDER_FRONTEND_URL not in origins:
            origins.append(self.RENDER_FRONTEND_URL)
        # Always allow localhost in dev
        if self.DEBUG:
            for local in ("http://localhost:3000", "http://127.0.0.1:3000"):
                if local not in origins:
                    origins.append(local)
        return origins

    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    @property
    def use_nvidia_nim(self) -> bool:
        """Check if NVIDIA NIM should be used."""
        return self.VISION_PROVIDER == "nvidia_nim" and bool(self.NVIDIA_API_KEY)

    @property
    def use_ollama(self) -> bool:
        """Check if Ollama should be used (local dev only)."""
        return self.VISION_PROVIDER == "ollama" and bool(self.OLLAMA_VISION_MODEL)

    @property
    def use_mock(self) -> bool:
        """Check if mock pipeline should be used."""
        if self.PIPELINE_MODE == "mock":
            return True
        # Fall back to mock if no provider is configured
        if not self.use_nvidia_nim and not self.use_ollama:
            return True
        return False


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()


def ensure_storage_dirs() -> None:
    for sub in ("uploads", "brand_guidelines", "reports"):
        (settings.STORAGE_DIR / sub).mkdir(parents=True, exist_ok=True)