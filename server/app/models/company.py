"""Company model — owns brand material, rules and analyses."""
from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin, uuid_pk


class Company(Base, TimestampMixin):
    __tablename__ = "companies"

    id: Mapped[uuid.UUID] = uuid_pk()
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    industry: Mapped[str | None] = mapped_column(String(120), nullable=True)
    website: Mapped[str | None] = mapped_column(String(500), nullable=True)
    owner_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )

    # API-key based authentication. The plaintext key is shown once at
    # onboarding ONLY; we persist its SHA-256 hash, never the key itself.
    api_key_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    api_key_prefix: Mapped[str] = mapped_column(String(12), nullable=False)

    owner = relationship("User", back_populates="companies")
    analyses = relationship("Analysis", backref="company_ref", cascade="all, delete-orphan")
