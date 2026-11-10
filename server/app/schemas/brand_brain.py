"""Brand Brain schemas."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

Severity = Literal["critical", "major", "minor", "info"]


class GuidelineFileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    filename: str
    size_bytes: int
    extracted_chars: int
    kind: Literal["pdf", "txt", "docx"]
    ok: bool
    note: str = ""


class BrandBrainOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    company_id: uuid.UUID
    version: int
    original_rules_text: str
    structured_rules: Optional[list] = None
    file_count: int
    extraction_status: str
    updated_at: datetime
    rule_count: int = 0
    enabled_rule_count: int = 0


class BrandRuleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    category: str
    requirement: str
    severity: Severity
    source_text: str
    source_type: str
    version: int = 1
    enabled: bool
    created_at: datetime
    updated_at: datetime


class BrandRuleVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    company_id: uuid.UUID
    rule_id: Optional[uuid.UUID] = None
    version: int
    change_type: str
    snapshot: dict
    changed_by_user_id: Optional[uuid.UUID] = None
    extraction_run_id: Optional[uuid.UUID] = None
    created_at: datetime


class ExtractionRunOut(BaseModel):
    id: str
    company_id: str
    status: str
    attempts: int
    max_attempts: int
    source_version: int
    source_chars: int
    model: str
    proposed_rules: list = []
    rejected_rules: list = []
    warnings: list = []
    error: Optional[str] = None
    error_code: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None
    committed_at: Optional[str] = None
    committed_rule_count: int = 0
    next_attempt_at: Optional[str] = None


class ExtractionCommitRequest(BaseModel):
    rules: list[dict] = Field(description="List of reviewed and approved rules/proposals")


class BrandRulesListResponse(BaseModel):
    company_id: uuid.UUID
    brain_version: int
    count: int
    rules: list[BrandRuleOut]


class BrandRuleCreate(BaseModel):
    """Manually adding a rule. `source_text` records the company's own wording."""

    model_config = ConfigDict(str_strip_whitespace=True)

    category: str = Field(default="general", min_length=1, max_length=60)
    requirement: str = Field(min_length=1, max_length=4000)
    severity: Severity = "major"
    source_text: str = Field(min_length=1, max_length=8000)


class BrandRuleUpdate(BaseModel):
    """PUT /brand-brain/rules — partial update.

    `source_text` is intentionally NOT editable: original wording is preserved.
    """

    model_config = ConfigDict(str_strip_whitespace=True)

    rule_id: uuid.UUID | None = None  # alternative to the path parameter
    category: str | None = Field(default=None, min_length=1, max_length=60)
    requirement: str | None = Field(default=None, min_length=1, max_length=4000)
    severity: Severity | None = None
    enabled: bool | None = None


class BrandBrainTextSave(BaseModel):
    """Optional JSON body for POST /brand-brain when no files are uploaded."""

    model_config = ConfigDict(str_strip_whitespace=True)

    rules_text: str = Field(min_length=1, max_length=200_000)
