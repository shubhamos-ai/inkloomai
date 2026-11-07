"""Browser session tokens for MongoDB (opaque, hashed at rest, server-side expiring)."""
from __future__ import annotations

from typing import Any
from app.db.mongodb import get_mongo_db
from app.models.base import FieldRef, MongoDocument


class AuthSession(MongoDocument):
    __tablename__ = "auth_sessions"
    __collection__ = "auth_sessions"

    id = FieldRef("_id")
    user_id = FieldRef("user_id")
    token_hash = FieldRef("token_hash")
    expires_at = FieldRef("expires_at")
    created_at = FieldRef("created_at")
    updated_at = FieldRef("updated_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    @property
    def user(self) -> Any | None:
        from app.models.user import User
        doc = get_mongo_db().users.find_one({"_id": str(self.user_id)})
        return User(doc) if doc else None
