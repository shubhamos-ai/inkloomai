"""Analysis model — one advertisement compliance review."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin, uuid_pk


class Analysis(Base, TimestampMixin):
    __tablename__ = "analyses"

    id: Mapped[uuid.UUID] = uuid_pk()
    company_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("companies.id", ondelete="CASCADE"), index=True, nullable=False
    )
    brain_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("brand_brains.id", ondelete="SET NULL"), nullable=True
    )

    # Storage path relative to STORAGE_DIR (never absolute, never user input).
    image_path: Mapped[str] = mapped_column(String(500), nullable=False)
    # Original client filename kept for display only, sanitized.
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False, default="")

    status: Mapped[str] = mapped_column(String(20), default="queued", nullable=False, index=True)

    compliance_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    overall_status: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Full structured report (validated by Pydantic before persisting).
    report: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # "mock" or the vision model name, e.g. "gemma3:4b".
    engine: Mapped[str] = mapped_column(String(60), nullable=False, default="mock")
    is_mock: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    job = relationship(
        "AnalysisJob", back_populates="analysis", uselist=False, cascade="all, delete-orphan"
    )
