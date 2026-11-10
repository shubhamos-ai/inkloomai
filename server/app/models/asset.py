"""Asset metadata for every durable object stored in S3/local storage."""
from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin, uuid_pk


class Asset(Base, TimestampMixin):
    __tablename__ = "assets"

    id: Mapped[uuid.UUID] = uuid_pk()
    company_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("companies.id", ondelete="CASCADE"), index=True, nullable=False
    )
    analysis_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("analyses.id", ondelete="CASCADE"), index=True, nullable=True
    )
    brain_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("brand_brains.id", ondelete="CASCADE"), index=True, nullable=True
    )

    # analysis_image | analysis_preview | guideline | report
    kind: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    storage_backend: Mapped[str] = mapped_column(String(10), nullable=False, default="local")
    object_key: Mapped[str] = mapped_column(String(700), nullable=False, index=True)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    content_type: Mapped[str] = mapped_column(String(120), nullable=False, default="application/octet-stream")
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    checksum_sha256: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    preview_key: Mapped[Optional[str]] = mapped_column(String(700), nullable=True)
