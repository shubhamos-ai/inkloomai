"""Analysis API schemas."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class AnalysisSubmitResponse(BaseModel):
    analysis_id: uuid.UUID
    status: str = "queued"
    message: str = "Advertisement queued for analysis"


class AnalysisStatusResponse(BaseModel):
    analysis_id: uuid.UUID
    status: str
    progress: int
    current_stage: str
    error: Optional[str] = None


class AnalysisListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    analysis_id: uuid.UUID
    status: str
    compliance_score: Optional[int] = None
    overall_status: Optional[str] = None
    engine: str
    is_mock: bool
    original_filename: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    has_report: bool = False


class PaginatedHistory(BaseModel):
    items: list[AnalysisListItem]
    total: int
    page: int
    limit: int
    pages: int


class ErrorResponse(BaseModel):
    error: str
    message: str
    detail: Optional[str] = Field(
        default=None,
        description="Included only when DEBUG=true. Never exposes paths or stack traces in production.",
    )
