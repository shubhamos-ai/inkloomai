"""Asset metadata helpers.

The bytes live in the storage backend; this table is the durable index that
lets ops answer "where is this object and is it still there?".
"""
from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Asset
from app.services import storage_service


def record_asset(
    db: Session,
    *,
    company_id: uuid.UUID,
    kind: str,
    object_key: str,
    analysis_id: Optional[uuid.UUID] = None,
    brain_id: Optional[uuid.UUID] = None,
    original_filename: str = "",
    content_type: str = "application/octet-stream",
    size_bytes: int = 0,
    checksum_sha256: str = "",
    preview_key: Optional[str] = None,
    data: Optional[bytes] = None,
) -> Asset:
    """Insert or update the metadata row for an object key.

    `data`, when supplied, is used to derive size + checksum if not provided.
    """
    if data is not None:
        size_bytes = size_bytes or len(data)
        checksum_sha256 = checksum_sha256 or storage_service.checksum_of(data)

    asset = db.scalar(
        select(Asset).where(
            Asset.company_id == company_id,
            Asset.object_key == object_key,
        )
    )
    if asset is None:
        asset = Asset(company_id=company_id, kind=kind, object_key=object_key)
        db.add(asset)

    asset.analysis_id = analysis_id
    asset.brain_id = brain_id
    asset.kind = kind
    asset.storage_backend = storage_service.storage_backend_name()
    asset.original_filename = original_filename[:255]
    asset.content_type = content_type[:120]
    asset.size_bytes = int(size_bytes or 0)
    asset.checksum_sha256 = checksum_sha256[:64]
    if preview_key:
        asset.preview_key = preview_key
    db.flush()
    return asset


def list_assets(
    db: Session, company_id: uuid.UUID, *, analysis_id: Optional[uuid.UUID] = None
) -> list[Asset]:
    query = select(Asset).where(Asset.company_id == company_id)
    if analysis_id is not None:
        query = query.where(Asset.analysis_id == analysis_id)
    return list(db.scalars(query.order_by(Asset.created_at)).all())


def get_asset(db: Session, company_id: uuid.UUID, asset_id: uuid.UUID) -> Asset | None:
    asset = db.get(Asset, asset_id)
    if asset is None or asset.company_id != company_id:
        return None
    return asset
