"""AnalysisJob model for MongoDB — background queue document."""
from __future__ import annotations

from typing import Any
from app.db.mongodb import get_mongo_db, utcnow
from app.models.base import FieldRef, MongoDocument


class AnalysisJob(MongoDocument):
    __tablename__ = "analysis_jobs"
    __collection__ = "analysis_jobs"

    id = FieldRef("_id")
    analysis_id = FieldRef("analysis_id")
    company_id = FieldRef("company_id")
    status = FieldRef("status")
    progress = FieldRef("progress")
    current_stage = FieldRef("current_stage")
    attempts = FieldRef("attempts")
    error = FieldRef("error")
    queued_at = FieldRef("queued_at")
    started_at = FieldRef("started_at")
    completed_at = FieldRef("completed_at")
    heartbeat_at = FieldRef("heartbeat_at")
    created_at = FieldRef("created_at")
    updated_at = FieldRef("updated_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if "status" not in self:
            self["status"] = "queued"
        if "progress" not in self:
            self["progress"] = 0
        if "attempts" not in self:
            self["attempts"] = 0
        if "queued_at" not in self:
            self["queued_at"] = utcnow()

    @property
    def analysis(self) -> Any | None:
        from app.models.analysis import Analysis
        doc = get_mongo_db().analyses.find_one({"_id": str(self.analysis_id)})
        return Analysis(doc) if doc else None
