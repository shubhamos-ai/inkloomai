"""Storage service — the single gateway to durable object storage.

Backends
--------
- **S3-compatible** (production): any S3 API provider (AWS S3, Cloudflare R2,
  Backblaze B2, MinIO). Selected when `STORAGE_BACKEND=s3` or when
  `STORAGE_BACKEND=auto` and bucket + credentials are configured.
- **Local disk** (development/tests only): `STORAGE_DIR`. Never the durable
  store in production.

Object layout (company IDs and generated IDs only, never person names):

    uploads/{company_id}/{analysis_id}/image.{kind}
    previews/{company_id}/{analysis_id}/preview.jpg
    brand_guidelines/{company_id}/{brain_id}/v{version}/{kind}-{uuid}-{name}
    reports/{company_id}/{analysis_id}/report.json

Every stored file gets a server-generated name; original client filenames are
kept in the database for display only.
"""
from __future__ import annotations

import hashlib
import io
import shutil
import uuid
from pathlib import Path
from typing import Optional

from app.config import settings
from app.utils.security import safe_relative_path, sanitize_filename

_S3_CLIENT = None


# ---------------------------------------------------------------------------
# Backend selection / low-level helpers
# ---------------------------------------------------------------------------

def storage_backend_name() -> str:
    return settings.storage_backend_name


def _local_root() -> Path:
    return settings.STORAGE_DIR.resolve()


def _abs(rel: str) -> Path:
    """Resolve a '/'-separated relative storage path, refusing escapes."""
    root = _local_root()
    target = (root / rel).resolve()
    if root != target and root not in target.parents:
        raise ValueError("Path escapes the storage root")
    return target


def _s3_key(rel: str) -> str:
    prefix = (settings.S3_PREFIX or "").strip("/")
    return f"{prefix}/{rel}" if prefix else rel


def _s3_client():
    global _S3_CLIENT
    if _S3_CLIENT is not None:
        return _S3_CLIENT
    try:
        import boto3
        from botocore.config import Config
    except ImportError as exc:  # pragma: no cover - dependency is declared
        raise RuntimeError(
            "S3 storage requires boto3. Install server/requirements.txt."
        ) from exc

    if not settings.S3_BUCKET:
        raise RuntimeError("STORAGE_BACKEND=s3 requires S3_BUCKET.")
    if not settings.S3_ACCESS_KEY_ID or not settings.S3_SECRET_ACCESS_KEY:
        raise RuntimeError("STORAGE_BACKEND=s3 requires S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.")

    _S3_CLIENT = boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT_URL or None,
        region_name=settings.S3_REGION or None,
        aws_access_key_id=settings.S3_ACCESS_KEY_ID,
        aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "path" if settings.S3_FORCE_PATH_STYLE else "auto"},
        ),
    )
    return _S3_CLIENT


def ensure_dirs() -> None:
    """Create the local cache/fallback tree. Safe for the S3 backend too."""
    for sub in ("uploads", "brand_guidelines", "reports", "previews"):
        (settings.STORAGE_DIR / sub).mkdir(parents=True, exist_ok=True)
    settings.STORAGE_CACHE_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Core object operations
# ---------------------------------------------------------------------------

def put_bytes(rel: str, data: bytes, *, content_type: str = "application/octet-stream") -> str:
    """Write bytes to the configured backend. Returns the relative key."""
    if settings.use_s3:
        _s3_client().put_object(
            Bucket=settings.S3_BUCKET,
            Key=_s3_key(rel),
            Body=data,
            ContentType=content_type,
        )
        # Keep a local copy for previews/vision without a second download.
        try:
            path = _abs(rel)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        except OSError:
            pass
    else:
        path = _abs(rel)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    return rel


def read_bytes(rel: str) -> bytes:
    if settings.use_s3:
        response = _s3_client().get_object(Bucket=settings.S3_BUCKET, Key=_s3_key(rel))
        return response["Body"].read()
    return _abs(rel).read_bytes()


def exists(rel: str) -> bool:
    if not rel:
        return False
    if settings.use_s3:
        try:
            _s3_client().head_object(Bucket=settings.S3_BUCKET, Key=_s3_key(rel))
            return True
        except Exception:  # noqa: BLE001 — missing object or transient error
            return False
    return _abs(rel).is_file()


def delete(rel: str) -> None:
    if settings.use_s3:
        _s3_client().delete_object(Bucket=settings.S3_BUCKET, Key=_s3_key(rel))
    try:
        path = _abs(rel)
        if path.is_file():
            path.unlink()
    except OSError:
        pass


def abs_path_for(rel_path: str) -> Path:
    """Local filesystem path for a stored object.

    For S3 objects this downloads into STORAGE_CACHE_DIR once and returns the
    cached path (the vision engine needs a real file).
    """
    if not settings.use_s3:
        return _abs(rel_path)
    cached = (settings.STORAGE_CACHE_DIR / rel_path).resolve()
    cache_root = settings.STORAGE_CACHE_DIR.resolve()
    if cache_root != cached and cache_root not in cached.parents:
        raise ValueError("Path escapes the storage cache root")
    if not cached.is_file():
        data = read_bytes(rel_path)
        cached.parent.mkdir(parents=True, exist_ok=True)
        cached.write_bytes(data)
    return cached


def presign_get(rel: str) -> Optional[str]:
    """Time-limited download URL for S3; None for the local backend."""
    if not settings.use_s3:
        return None
    return _s3_client().generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.S3_BUCKET, "Key": _s3_key(rel)},
        ExpiresIn=settings.S3_PRESIGN_EXPIRES_SECONDS,
    )


def checksum_of(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


# ---------------------------------------------------------------------------
# Domain-specific writers (kept backward compatible)
# ---------------------------------------------------------------------------

def write_analysis_image(
    company_id: uuid.UUID,
    analysis_id: uuid.UUID,
    *,
    data: bytes,
    kind: str,
    content_type: str | None = None,
) -> str:
    rel = safe_relative_path("uploads", str(company_id), str(analysis_id), f"image.{kind}")
    return put_bytes(rel, data, content_type=content_type or f"image/{kind}")


def write_guideline_file(
    company_id: uuid.UUID,
    brain_id: uuid.UUID,
    version: int,
    *,
    data: bytes,
    original_name: str,
    kind: str,
    content_type: str = "application/octet-stream",
) -> str:
    safe_name = sanitize_filename(original_name, fallback=f"guideline.{kind}")
    stored = f"{kind}-{uuid.uuid4().hex}-{safe_name}"
    rel = safe_relative_path(
        "brand_guidelines", str(company_id), str(brain_id), f"v{version}", stored
    )
    return put_bytes(rel, data, content_type=content_type)


def write_report_json(company_id: uuid.UUID, analysis_id: uuid.UUID, report: dict) -> str | None:
    """Optional JSON export next to the DB copy. Best-effort, never fatal."""
    import json

    try:
        rel = safe_relative_path("reports", str(company_id), str(analysis_id), "report.json")
        return put_bytes(
            rel,
            json.dumps(report, indent=2, default=str).encode("utf-8"),
            content_type="application/json",
        )
    except Exception:
        return None


def make_preview(data: bytes, *, max_dim: int | None = None) -> bytes | None:
    """Create a JPEG thumbnail. Returns None when Pillow cannot decode."""
    try:
        from PIL import Image

        image = Image.open(io.BytesIO(data))
        image.thumbnail((max_dim or settings.PREVIEW_MAX_DIMENSION,) * 2)
        if image.mode not in ("RGB", "L"):
            image = image.convert("RGB")
        out = io.BytesIO()
        image.save(out, format="JPEG", quality=82)
        return out.getvalue()
    except Exception:  # noqa: BLE001 — preview is a convenience, never fatal
        return None


def write_analysis_preview(
    company_id: uuid.UUID, analysis_id: uuid.UUID, *, image_data: bytes
) -> str | None:
    preview = make_preview(image_data)
    if preview is None:
        return None
    rel = safe_relative_path("previews", str(company_id), str(analysis_id), "preview.jpg")
    return put_bytes(rel, preview, content_type="image/jpeg")


# ---------------------------------------------------------------------------
# Introspection / maintenance
# ---------------------------------------------------------------------------

def list_directory(rel_dir: str) -> list[dict]:
    """List files of a stored directory (names + sizes) for status endpoints."""
    if settings.use_s3:
        prefix = _s3_key(rel_dir.rstrip("/") + "/")
        try:
            response = _s3_client().list_objects_v2(Bucket=settings.S3_BUCKET, Prefix=prefix)
        except Exception:  # noqa: BLE001
            return []
        return [
            {"filename": item["Key"].rsplit("/", 1)[-1], "size_bytes": item.get("Size", 0)}
            for item in response.get("Contents", [])
        ]

    path = _abs(rel_dir) if rel_dir else None
    if not path or not path.is_dir():
        return []
    return [
        {"filename": p.name, "size_bytes": p.stat().st_size}
        for p in sorted(path.iterdir())
        if p.is_file()
    ]


def storage_usage() -> int:
    """Total bytes stored (used by ops health reporting)."""
    if settings.use_s3:
        total = 0
        prefix = _s3_key("")
        try:
            paginator = _s3_client().get_paginator("list_objects_v2")
            for page in paginator.paginate(Bucket=settings.S3_BUCKET, Prefix=prefix):
                total += sum(item.get("Size", 0) for item in page.get("Contents", []))
        except Exception:  # noqa: BLE001
            return 0
        return total

    total = 0
    for path in settings.STORAGE_DIR.rglob("*"):
        if path.is_file():
            try:
                total += path.stat().st_size
            except OSError:
                continue
    return total


def remove_tree(rel: str) -> None:
    if settings.use_s3:
        prefix = _s3_key(rel.rstrip("/") + "/")
        try:
            client = _s3_client()
            paginator = client.get_paginator("list_objects_v2")
            for page in paginator.paginate(Bucket=settings.S3_BUCKET, Prefix=prefix):
                keys = [{"Key": item["Key"]} for item in page.get("Contents", [])]
                if keys:
                    client.delete_objects(
                        Bucket=settings.S3_BUCKET, Delete={"Objects": keys}
                    )
        except Exception:  # noqa: BLE001 — cleanup is best-effort
            pass
    shutil.rmtree(_abs(rel), ignore_errors=True)
