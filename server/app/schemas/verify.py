"""Pydantic schemas for ad compliance verification endpoint."""
from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel, Field


class VerifyViolation(BaseModel):
    rule: str
    violation_type: str
    explanation: str
    severity: str


class VerifyAdRequest(BaseModel):
    company_name: str
    rules: list[str]
    ad_headline: str = ""
    ad_copy: str = ""
    media_metrics: Optional[dict[str, Any]] = None
    text_metrics: Optional[dict[str, Any]] = None


class VerifyAdResponse(BaseModel):
    status: str = Field(description="'COMPLIANT' or 'NON_COMPLIANT'")
    total_violations: int
    violations: list[VerifyViolation]
