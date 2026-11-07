"""Database engine, session management, and compatibility layer for local MongoDB."""
from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Any

from app.config import settings
from app.db.mongodb import MongoDBSession, db_ready as _mongo_db_ready, get_mongo_db, utcnow
from app.models.base import Base, MongoDocument, func, select, update

Session = MongoDBSession


def text(stmt: str) -> str:
    return stmt


# Export Base for ORM model declarations
__all__ = [
    "Base",
    "Session",
    "SessionLocal",
    "get_db",
    "db_ready",
    "utcnow",
    "select",
    "update",
    "func",
    "text",
    "engine",
]


class _MongoEngineStub:
    """Mock engine allowing legacy SQLAlchemy engine hooks to succeed gracefully."""

    def begin(self):
        class _Ctx:
            def __enter__(self):
                return self

            def __exit__(self, *args):
                pass

            def execute(self, *args, **kwargs):
                return None

        return _Ctx()

    def connect(self):
        class _Conn:
            def __enter__(self):
                return self

            def __exit__(self, *args):
                pass

            def execute(self, *args, **kwargs):
                return None

        return _Conn()


engine = _MongoEngineStub()


def SessionLocal() -> MongoDBSession:
    """Factory creating a MongoDBSession."""
    return MongoDBSession()


def db_ready() -> bool:
    """Connectivity check used by the health endpoint."""
    return _mongo_db_ready()


def get_db():
    """FastAPI dependency yielding a MongoDB-backed session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def postgres_url_from_sqlite(sqlite_url: str) -> str:
    if not sqlite_url.startswith("sqlite"):
        raise ValueError("Expected a SQLite URL")
    return re.sub(r"^sqlite:///(.*)$", r"mongodb://127.0.0.1:27017/inkloom", sqlite_url)
