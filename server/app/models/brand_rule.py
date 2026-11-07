"""BrandRule model for MongoDB — one structured brand governance rule."""
from __future__ import annotations

from typing import Any
from app.db.mongodb import get_mongo_db
from app.models.base import FieldRef, MongoDocument


class BrandRule(MongoDocument):
    __tablename__ = "brand_rules"
    __collection__ = "brand_rules"

    id = FieldRef("_id")
    company_id = FieldRef("company_id")
    brain_id = FieldRef("brain_id")
    code = FieldRef("code")
    category = FieldRef("category")
    requirement = FieldRef("requirement")
    severity = FieldRef("severity")
    source_text = FieldRef("source_text")
    source_type = FieldRef("source_type")
    enabled = FieldRef("enabled")
    created_at = FieldRef("created_at")
    updated_at = FieldRef("updated_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if "category" not in self:
            self["category"] = "general"
        if "severity" not in self:
            self["severity"] = "major"
        if "enabled" not in self:
            self["enabled"] = True
        if "source_type" not in self:
            self["source_type"] = "manual"

    @property
    def brain(self) -> Any | None:
        from app.models.brand_brain import BrandBrain
        doc = get_mongo_db().brand_brains.find_one({"_id": str(self.brain_id)})
        return BrandBrain(doc) if doc else None
