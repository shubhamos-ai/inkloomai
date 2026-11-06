"""User model — email/password accounts for the Netflix-style onboarding."""
from __future__ import annotations

import uuid

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.base import TimestampMixin, uuid_pk


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # Nullable for legacy dev-mode accounts; required for new sign-ups.
    email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    # pbkdf2_sha256$<iter>$<salt>$<hash> (see utils.security.hash_password).
    # NULL = legacy row that can only use company API keys.
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)

    companies = relationship("Company", back_populates="owner")
    sessions = relationship(
        "AuthSession", back_populates="user", cascade="all, delete-orphan"
    )
