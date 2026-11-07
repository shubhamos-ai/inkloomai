"""Analysis model for MongoDB — one advertisement compliance review."""
from __future__ import annotations

from typing import Any
from app.db.mongodb import get_mongo_db
from app.models.base import FieldRef, MongoDocument


class Analysis(MongoDocument):
    __tablename__ = "analyses"
    __collection__ = "analyses"

    id = FieldRef("_id")
    company_id = FieldRef("company_id")
    brain_id = FieldRef("brain_id")
    image_path = FieldRef("image_path")
    original_filename = FieldRef("original_filename")
    status = FieldRef("status")
    compliance_score = FieldRef("compliance_score")
    overall_status = FieldRef("overall_status")
    final_decision = FieldRef("final_decision")
    summary = FieldRef("summary")
    report = FieldRef("report")
    engine = FieldRef("engine")
    is_mock = FieldRef("is_mock")
    completed_at = FieldRef("completed_at")
    created_at = FieldRef("created_at")
    updated_at = FieldRef("updated_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if "status" not in self:
            self["status"] = "queued"
        if "is_mock" not in self:
            self["is_mock"] = False
        if "engine" not in self:
            self["engine"] = "nvidia/nemotron-3.5-super-vl-120b-a12b"

    @property
    def job(self) -> Any | None:
        from app.models.analysis_job import AnalysisJob
        doc = get_mongo_db().analysis_jobs.find_one({"analysis_id": str(self.id)})
        return AnalysisJob(doc) if doc else None
