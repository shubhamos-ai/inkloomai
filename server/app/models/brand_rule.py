"""BrandRule model — one structured brand governance rule."""
from __future__ import annotations

import uuid

from sqlalchemy import Boolean, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin, uuid_pk


class BrandRule(Base, TimestampMixin):
    __tablename__ = "brand_rules"

    id: Mapped[uuid.UUID] = uuid_pk()
    company_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("companies.id", ondelete="CASCADE"), index=True, nullable=False
    )
    brain_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("brand_brains.id", ondelete="CASCADE"), index=True, nullable=False
    )

    code: Mapped[str] = mapped_column(String(20), nullable=False)  # e.g. BR001
    category: Mapped[str] = mapped_column(String(60), nullable=False, default="general")
    requirement: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="major")

    # Exact original wording the rule was derived from — never rewritten.
    source_text: Mapped[str] = mapped_column(Text, nullable=False)

    # "manual" if hand-entered, else the AI extraction batch id/date.
    source_type: Mapped[str] = mapped_column(String(30), default="manual", nullable=False)

    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)

    brain = relationship("BrandBrain", back_populates="rules")
