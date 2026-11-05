"""Storage service — the single gateway to the `server/storage` tree.

Layout (company IDs and generated IDs only, never person names):

    storage/
      uploads/{company_id}/{analysis_id}/image.png
      brand_guidelines/{company_id}/{brain_id}/{version}/{kind}-{uuid}.{ext}
      reports/{company_id}/{analysis_id}/report.json

Every stored file gets a server-generated UUID filename; original client
filenames are kept in the database for display only.
"""
from __future__ import annotations

import shutil
import uuid
from pathlib import Path

from app.config import settings
from app.utils.security import safe_relative_path, sanitize_filename


def _abs(rel: str) -> Path:
    """Resolve a '/'-separated relative storage path, refusing escapes."""
    root = settings.STORAGE_DIR.resolve()
    target = (root / rel).resolve()
    if root != target and root not in target.parents:
        raise ValueError("Path escapes the storage root")
    return target


def abs_path_for(rel_path: str) -> Path:
    """Public helper: absolute path for a stored relative path (image serving)."""
    return _abs(rel_path)


def ensure_dirs() -> None:
    for sub in ("uploads", "brand_guidelines", "reports"):
        (settings.STORAGE_DIR / sub).mkdir(parents=True, exist_ok=True)


def write_analysis_image(company_id: uuid.UUID, analysis_id: uuid.UUID, *, data: bytes, kind: str) -> str:
    """Persist the validated advertisement image. Returns the relative path."""
    rel = safe_relative_path("uploads", str(company_id), str(analysis_id), f"image.{kind}")
    path = _abs(rel)
    path.parent.mkdir(parents=True, exist_ok=True)
    # 0600: uploads are private data, one company never reads another's files.
    path.write_bytes(data)
    return rel


def write_guideline_file(
    company_id: uuid.UUID, brain_id: uuid.UUID, version: int, *, data: bytes, original_name: str, kind: str
) -> str:
    """Persist an uploaded guideline document. Returns the relative path."""
    safe_name = sanitize_filename(original_name, fallback=f"guideline.{kind}")
    stored = f"{kind}-{uuid.uuid4().hex}-{safe_name}"
    rel = safe_relative_path(
        "brand_guidelines", str(company_id), str(brain_id), f"v{version}", stored
    )
    path = _abs(rel)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return rel


def list_directory(rel_dir: str) -> list[dict]:
    """List files of a stored directory (names + sizes) for status endpoints."""
    path = _abs(rel_dir) if rel_dir else None
    if not path or not path.is_dir():
        return []
    return [
        {"filename": p.name, "size_bytes": p.stat().st_size}
        for p in sorted(path.iterdir())
        if p.is_file()
    ]


def write_report_json(company_id: uuid.UUID, analysis_id: uuid.UUID, report: dict) -> str | None:
    """Optional JSON export next to the DB copy. Best-effort, never fatal."""
    import json

    try:
        rel = safe_relative_path("reports", str(company_id), str(analysis_id), "report.json")
        path = _abs(rel)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
        return rel
    except Exception:
        return None


def storage_usage() -> int:
    """Total bytes stored (used by ops health reporting)."""
    total = 0
    for path in settings.STORAGE_DIR.rglob("*"):
        if path.is_file():
            try:
                total += path.stat().st_size
            except OSError:
                continue
    return total


def remove_tree(rel: str) -> None:
    shutil.rmtree(_abs(rel), ignore_errors=True)
