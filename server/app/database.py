"""Database engine, session management and constants."""
from __future__ import annotations

import re
from datetime import UTC, datetime

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


def _make_engine():
    url = settings.DATABASE_URL
    is_sqlite = url.startswith("sqlite")
    engine = create_engine(
        url,
        # Allow sessions across FastAPI's threadpool threads.
        connect_args={"check_same_thread": False} if is_sqlite else {},
        pool_pre_ping=True,
    )
    if is_sqlite:
        @event.listens_for(engine, "connect")
        def _set_sqlite_pragma(dbapi_connection, _connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.close()
    return engine


engine = _make_engine()

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, class_=Session)


def utcnow() -> datetime:
    """Naive-UTC timestamp helper (stored consistently in SQLite)."""
    return datetime.now(UTC).replace(tzinfo=None)


def db_ready() -> bool:
    """Cheap connectivity check used by the health endpoint."""
    try:
        from sqlalchemy import text

        with SessionLocal() as session:
            session.execute(text("SELECT 1"))
        return True
    except Exception:  # noqa: BLE001 — health must never raise
        return False


def get_db():
    """FastAPI dependency yielding a DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def postgres_url_from_sqlite(sqlite_url: str) -> str:
    """
    Helper for the SQLite -> PostgreSQL migration path.

    Sets a sane production PostgreSQL URL format that Alembic/SQLAlchemy accept,
    so switching is a matter of changing DATABASE_URL and running migrations.
    """
    if not sqlite_url.startswith("sqlite"):
        raise ValueError("Expected a SQLAlchemy SQLite URL")
    return re.sub(r"^sqlite:///(.*)$", r"postgresql://USER:PASSWORD@HOST:5432/DBNAME", sqlite_url)
