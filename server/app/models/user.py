"""User model for MongoDB — email/password accounts for onboarding."""
from __future__ import annotations

from typing import Any
from app.db.mongodb import get_mongo_db
from app.models.base import FieldRef, MongoDocument


class User(MongoDocument):
    __tablename__ = "users"
    __collection__ = "users"

    id = FieldRef("_id")
    name = FieldRef("name")
    email = FieldRef("email")
    password_hash = FieldRef("password_hash")
    created_at = FieldRef("created_at")
    updated_at = FieldRef("updated_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    @property
    def companies(self) -> list[Any]:
        from app.models.company import Company
        docs = get_mongo_db().companies.find({"owner_user_id": str(self.id)}).sort("created_at", 1)
        return [Company(d) for d in docs]

    @property
    def sessions(self) -> list[Any]:
        from app.models.session import AuthSession
        docs = get_mongo_db().auth_sessions.find({"user_id": str(self.id)})
        return [AuthSession(d) for d in docs]
