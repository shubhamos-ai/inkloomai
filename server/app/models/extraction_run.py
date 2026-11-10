"""ExtractionRun model — durable queue row for AI brand-rule extraction.

A run snapshots the Brand Brain's current text, asks the configured model to
propose structured rules, and stages the proposals (never persisted as rules)
until a human reviews and commits them.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin, uuid_pk


class ExtractionRun(Base, TimestampMixin):
    __tablename__ = "extraction_runs"

    id: Mapped[uuid.UUID] = uuid_pk()
    company_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("companies.id", ondelete="CASCADE"), index=True, nullable=False
    )
    brain_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("brand_brains.id", ondelete="CASCADE"), index=True, nullable=False
    )
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    status: Mapped[str] = mapped_column(
        String(20), default="queued", nullable=False, index=True
    )
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=3, nullable=False)

    # Snapshot metadata so a commit is reproducible even if the brain changes.
    source_version: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    source_chars: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    model: Mapped[str] = mapped_column(String(120), default="", nullable=False)

    # Staged proposals (list of dicts) + honest diagnostics.
    proposed_rules: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    rejected_rules: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    warnings: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    error_code: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)

    queued_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    heartbeat_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    next_attempt_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    committed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    committed_rule_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
