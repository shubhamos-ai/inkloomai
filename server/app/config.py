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


def _normalize_database_url(url: str) -> str:
    """Return a SQLAlchemy URL that matches the driver installed in this image.

    Render (and Heroku) expose plain ``postgresql://`` / ``postgres://`` URLs.
    SQLAlchemy 2.1 resolves that bare scheme to psycopg (v3), while this
    project ships ``psycopg2-binary``. Pin the driver explicitly so the API,
    Alembic and the worker all agree on one DBAPI.

    A MongoDB URL is rejected with an actionable message instead of a cryptic
    "Can't load plugin: sqlalchemy.dialects:mongodb.srv" import crash.
    """
    if url.startswith("postgres://"):
        return "postgresql+psycopg2://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        return "postgresql+psycopg2://" + url[len("postgresql://"):]
    if url.startswith(("mongodb://", "mongodb+srv://")):
        raise ValueError(
            "DATABASE_URL points at MongoDB, but Inkloom stores data in "
            "PostgreSQL/SQLite through SQLAlchemy. Set DATABASE_URL to the "
            "Render Postgres connection string (or a sqlite:// URL for local "
            "development)."
        )
    return url


class Settings:
    """Runtime settings. Values marked DEV/INSECURE must never reach production."""

    APP_NAME: str = "Inkloom AI"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"

    # ------------------------------------------------------------------
    # Database
    # ------------------------------------------------------------------
    DATABASE_URL: str = _normalize_database_url(
        os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'data' / 'inkloom.db'}")
    )

    # ------------------------------------------------------------------
    # Storage
    # ------------------------------------------------------------------
    STORAGE_DIR: Path = Path(os.getenv("STORAGE_DIR", str(BASE_DIR / "storage")))
    MAX_UPLOAD_SIZE_MB: int = int(os.getenv("MAX_UPLOAD_SIZE_MB", "15"))
    MIN_IMAGE_DIMENSION: int = int(os.getenv("MIN_IMAGE_DIMENSION", "64"))
    MAX_IMAGE_DIMENSION: int = int(os.getenv("MAX_IMAGE_DIMENSION", "8000"))

    # "auto" = S3 when S3_BUCKET + credentials are configured, else local.
    # "local" is for development/tests only; "s3" fails fast if misconfigured.
    STORAGE_BACKEND: str = os.getenv("STORAGE_BACKEND", "auto").lower()
    S3_BUCKET: str = os.getenv("S3_BUCKET", "")
    S3_ENDPOINT_URL: str = os.getenv("S3_ENDPOINT_URL", "")  # e.g. Cloudflare R2 / MinIO
    S3_REGION: str = os.getenv("S3_REGION", "auto")
    S3_ACCESS_KEY_ID: str = os.getenv("S3_ACCESS_KEY_ID", "")
    S3_SECRET_ACCESS_KEY: str = os.getenv("S3_SECRET_ACCESS_KEY", "")
    S3_PREFIX: str = os.getenv("S3_PREFIX", "inkloom")
    S3_FORCE_PATH_STYLE: bool = os.getenv("S3_FORCE_PATH_STYLE", "false").lower() == "true"
    S3_PRESIGN_EXPIRES_SECONDS: int = int(os.getenv("S3_PRESIGN_EXPIRES_SECONDS", "900"))
    # Local cache used to materialise S3 objects for Pillow/vision engines.
    STORAGE_CACHE_DIR: Path = Path(
        os.getenv("STORAGE_CACHE_DIR", str(BASE_DIR / ".storage-cache"))
    )
    PREVIEW_MAX_DIMENSION: int = int(os.getenv("PREVIEW_MAX_DIMENSION", "640"))

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
    # Stricter per-IP budget for /auth/login and /auth/register.
    AUTH_RATE_LIMIT_PER_MINUTE: int = int(os.getenv("AUTH_RATE_LIMIT_PER_MINUTE", "10"))

    # ------------------------------------------------------------------
    # Cookie sessions / CSRF
    # ------------------------------------------------------------------
    SESSION_COOKIE_NAME: str = os.getenv("SESSION_COOKIE_NAME", "inkloom_session")
    CSRF_COOKIE_NAME: str = os.getenv("CSRF_COOKIE_NAME", "inkloom_csrf")
    SESSION_LIFETIME_DAYS: int = int(os.getenv("SESSION_LIFETIME_DAYS", "30"))
    # Secure cookies require HTTPS. DEBUG defaults to true locally, so this
    # automatically disables Secure on http://localhost.
    COOKIE_SECURE: bool = os.getenv(
        "COOKIE_SECURE", "false" if os.getenv("DEBUG", "true").lower() == "true" else "true"
    ).lower() == "true"
    COOKIE_SAMESITE: str = os.getenv("COOKIE_SAMESITE", "lax")
    # Comma-separated extra origins allowed to read credentialed responses.
    COOKIE_DOMAIN: str = os.getenv("COOKIE_DOMAIN", "")

    # ------------------------------------------------------------------
    # AI Vision Provider Selection
    # ------------------------------------------------------------------
    # Options: "nvidia_nim" (production), "ollama" (local dev), "mock" (testing)
    VISION_PROVIDER: str = os.getenv("VISION_PROVIDER", "nvidia_nim")

    # ------------------------------------------------------------------
    # NVIDIA NIM (production - deployable on Render.com)
    # Get your API key from: https://build.nvidia.com/meta/llama-3.2-11b-vision-instruct
    # Example: nvapi-<your-key> (never commit a real key)
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
    # Brand-rule extraction (AI structuring of the original guidelines)
    # ------------------------------------------------------------------
    # "auto" -> NVIDIA NIM when configured, then Ollama, else not configured.
    EXTRACTION_PROVIDER: str = os.getenv("EXTRACTION_PROVIDER", "auto")
    # Rule extraction is a text task; a fast non-reasoning instruct model is
    # both quicker and cheaper than the 90B vision model. Override with any
    # chat-completions model tag the provider serves.
    EXTRACTION_MODEL: str = os.getenv(
        "EXTRACTION_MODEL", "nvidia/nemotron-3.5-lightning-30b-a3b"
    )
    EXTRACTION_MAX_RULES: int = int(os.getenv("EXTRACTION_MAX_RULES", "80"))
    # Diversity guard: stop one noisy section (e.g. a long prohibited-claims
    # list) from consuming the whole proposal budget.
    EXTRACTION_MAX_RULES_PER_CATEGORY: int = int(
        os.getenv("EXTRACTION_MAX_RULES_PER_CATEGORY", "12")
    )
    EXTRACTION_MAX_CHARS: int = int(os.getenv("EXTRACTION_MAX_CHARS", "60000"))
    # 80 rules need roughly 6-7k completion tokens; 8192 avoids truncation.
    EXTRACTION_MAX_TOKENS: int = int(os.getenv("EXTRACTION_MAX_TOKENS", "8192"))
    # Per-request provider timeout. Long guideline documents take 60-120s.
    EXTRACTION_TIMEOUT_SECONDS: float = float(os.getenv("EXTRACTION_TIMEOUT_SECONDS", "180"))

    # ------------------------------------------------------------------
    # Compliance audit (vision + rule evaluation)
    # ------------------------------------------------------------------
    # Evaluate a large rulebook in chunks. One request for 58+ rules overflows
    # the completion budget and returns truncated JSON, which used to fail the
    # whole audit. Batching keeps every request comfortably inside the budget.
    COMPLIANCE_BATCH_SIZE: int = int(os.getenv("COMPLIANCE_BATCH_SIZE", "20"))
    COMPLIANCE_MAX_TOKENS: int = int(os.getenv("COMPLIANCE_MAX_TOKENS", "4096"))
    COMPLIANCE_TIMEOUT_SECONDS: float = float(os.getenv("COMPLIANCE_TIMEOUT_SECONDS", "180"))

    # ------------------------------------------------------------------
    # Worker / job queue
    # ------------------------------------------------------------------
    WORKER_POLL_INTERVAL_SECONDS: float = float(os.getenv("WORKER_POLL_INTERVAL_SECONDS", "1.0"))
    STALE_JOB_AFTER_SECONDS: float = float(os.getenv("STALE_JOB_AFTER_SECONDS", "300"))
    MAX_JOB_ATTEMPTS: int = int(os.getenv("MAX_JOB_ATTEMPTS", "3"))
    WORKER_ID: str = os.getenv("WORKER_ID", "")
    JOB_BACKOFF_BASE_SECONDS: float = float(os.getenv("JOB_BACKOFF_BASE_SECONDS", "10"))
    JOB_BACKOFF_MAX_SECONDS: float = float(os.getenv("JOB_BACKOFF_MAX_SECONDS", "300"))
    # Run the job loop inside the API process.
    # "auto" (default): enabled only when storage is local, because a separate
    # Render worker cannot read a disk attached to the web service. With S3
    # configured, set "false" and let the dedicated worker service drain queues.
    RUN_EMBEDDED_WORKER: str = os.getenv("RUN_EMBEDDED_WORKER", "auto").lower()
    # A standalone worker may only run analysis when it can read uploads.
    # With local storage that is only true on the same machine/disk.
    WORKER_ALLOW_LOCAL_ANALYSIS: bool = (
        os.getenv("WORKER_ALLOW_LOCAL_ANALYSIS", "false").lower() == "true"
    )

    @property
    def all_origins(self) -> list[str]:
        origins = list(self.CORS_ORIGINS) + list(self.CORS_EXTRA_ORIGINS)
        # Always ensure production custom domains and Render hosts are recognized
        for known in (
            "https://inkloom-ai.shubhamos.com",
            "https://inkoom-ai.shubhamos.com",
            "https://inkloom-frontend-rwy2.onrender.com",
            "https://inkloom-frontend.onrender.com",
        ):
            if known not in origins:
                origins.append(known)
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
        """True only when the mock pipeline is explicitly requested.

        A missing AI provider is *not* silently downgraded to mock output in
        production: the job fails with a configuration error instead, so a
        report is never labelled real when no inference happened.
        """
        return self.PIPELINE_MODE == "mock"

    @property
    def use_s3(self) -> bool:
        """True when the S3-compatible backend is the configured store."""
        if self.STORAGE_BACKEND == "local":
            return False
        if self.STORAGE_BACKEND == "s3":
            return True
        return bool(self.S3_BUCKET and self.S3_ACCESS_KEY_ID and self.S3_SECRET_ACCESS_KEY)

    @property
    def storage_backend_name(self) -> str:
        return "s3" if self.use_s3 else "local"

    @property
    def run_embedded_worker(self) -> bool:
        """Whether the API process should drain queues itself."""
        if self.RUN_EMBEDDED_WORKER in ("true", "1", "yes"):
            return True
        if self.RUN_EMBEDDED_WORKER in ("false", "0", "no"):
            return False
        # auto: embedded is the safe default while storage is a local disk.
        return not self.use_s3

    @property
    def worker_can_process_analysis(self) -> bool:
        """A worker can run vision jobs only if it shares the upload store."""
        return self.use_s3 or self.WORKER_ALLOW_LOCAL_ANALYSIS

    @property
    def extraction_provider_name(self) -> str:
        """Resolve the extraction provider without calling any API."""
        if self.EXTRACTION_PROVIDER in ("nvidia_nim", "ollama"):
            return self.EXTRACTION_PROVIDER
        if self.use_nvidia_nim:
            return "nvidia_nim"
        if self.use_ollama:
            return "ollama"
        return "not_configured"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()


def ensure_storage_dirs() -> None:
    for sub in ("uploads", "brand_guidelines", "reports"):
        (settings.STORAGE_DIR / sub).mkdir(parents=True, exist_ok=True)