"""Company model for MongoDB — owns brand material, rules, and analyses."""
from __future__ import annotations

from typing import Any
from app.db.mongodb import get_mongo_db
from app.models.base import FieldRef, MongoDocument


class Company(MongoDocument):
    __tablename__ = "companies"
    __collection__ = "companies"

    id = FieldRef("_id")
    company_name = FieldRef("company_name")
    industry = FieldRef("industry")
    website = FieldRef("website")
    owner_user_id = FieldRef("owner_user_id")
    api_key_hash = FieldRef("api_key_hash")
    api_key_prefix = FieldRef("api_key_prefix")
    created_at = FieldRef("created_at")
    updated_at = FieldRef("updated_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    @property
    def owner(self) -> Any | None:
        from app.models.user import User
        doc = get_mongo_db().users.find_one({"_id": str(self.owner_user_id)})
        return User(doc) if doc else None

    @property
    def analyses(self) -> list[Any]:
        from app.models.analysis import Analysis
        docs = get_mongo_db().analyses.find({"company_id": str(self.id)}).sort("created_at", -1)
        return [Analysis(d) for d in docs]
