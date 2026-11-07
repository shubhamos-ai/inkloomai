"""BrandBrain model for MongoDB — per-company store of brand rules material."""
from __future__ import annotations

from typing import Any
from app.db.mongodb import get_mongo_db
from app.models.base import FieldRef, MongoDocument


class BrandBrain(MongoDocument):
    __tablename__ = "brand_brains"
    __collection__ = "brand_brains"

    id = FieldRef("_id")
    company_id = FieldRef("company_id")
    version = FieldRef("version")
    original_rules_text = FieldRef("original_rules_text")
    structured_rules = FieldRef("structured_rules")
    files_dir = FieldRef("files_dir")
    file_count = FieldRef("file_count")
    extraction_status = FieldRef("extraction_status")
    created_at = FieldRef("created_at")
    updated_at = FieldRef("updated_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if "version" not in self:
            self["version"] = 1
        if "original_rules_text" not in self:
            self["original_rules_text"] = ""
        if "file_count" not in self or self["file_count"] is None:
            self["file_count"] = 0
        if "extraction_status" not in self:
            self["extraction_status"] = "pending"

    @property
    def rules(self) -> list[Any]:
        from app.models.brand_rule import BrandRule
        docs = get_mongo_db().brand_rules.find({"brain_id": str(self.id)}).sort("code", 1)
        return [BrandRule(d) for d in docs]
