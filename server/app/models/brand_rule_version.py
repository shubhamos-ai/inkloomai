"""Immutable brand-rule history.

Every create/update/delete writes a snapshot row. Rule rows themselves remain
the current state; this table is the audit trail the UI can display.
"""
from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import JSON, ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import TimestampMixin, uuid_pk


class BrandRuleVersion(Base, TimestampMixin):
    __tablename__ = "brand_rule_versions"

    id: Mapped[uuid.UUID] = uuid_pk()
    company_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("companies.id", ondelete="CASCADE"), index=True, nullable=False
    )
    rule_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("brand_rules.id", ondelete="SET NULL"), index=True, nullable=True
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    # created | updated | deleted | extraction_committed
    change_type: Mapped[str] = mapped_column(String(30), nullable=False)
    snapshot: Mapped[dict] = mapped_column(JSON, nullable=False)
    changed_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    extraction_run_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid, ForeignKey("extraction_runs.id", ondelete="SET NULL"), nullable=True
    )
