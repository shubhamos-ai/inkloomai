"""Shared model helpers: PK, mixins and status constants."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base, utcnow

JOB_STATUSES = ("queued", "processing", "completed", "failed", "cancelled")
ANALYSIS_STATUSES = ("queued", "processing", "completed", "failed", "cancelled")
SEVERITIES = ("critical", "major", "minor", "info")
OVERALL_STATUSES = ("passed", "needs_revision", "critical_failure", "inconclusive", "failed")


def uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(primary_key=True, default=uuid.uuid4)


class TimestampMixin:
    __abstract__ = True

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=utcnow, onupdate=utcnow, nullable=False
    )
