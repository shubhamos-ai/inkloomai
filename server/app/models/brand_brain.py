"""BrandBrain model — per-company store of the original rules material.

The original wording is sacred: `original_rules_text` is append-only, and
`structured_rules` stays null until the AI extraction service produces it.
"""
from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import JSON, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin, uuid_pk


class BrandBrain(Base, TimestampMixin):
    __tablename__ = "brand_brains"

    id: Mapped[uuid.UUID] = uuid_pk()
    company_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("companies.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )

    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Original ingest material, preserved verbatim (append-only).
    original_rules_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # AI-extracted structured rules (null until extraction runs).
    structured_rules: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    # Directory (relative to STORAGE_DIR) where the uploaded guideline files live.
    files_dir: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    file_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # pending | manual | ai_extracted
    extraction_status: Mapped[str] = mapped_column(String(30), default="pending", nullable=False)

    rules = relationship(
        "BrandRule",
        back_populates="brain",
        cascade="all, delete-orphan",
        order_by="BrandRule.code",
    )
