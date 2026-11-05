"""Standard Phase-6 report schema. All engine output MUST validate here
before it is ever written to the database."""
from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

RuleSeverity = Literal["critical", "major", "minor", "info"]
CheckState = Literal["passed", "failed", "inconclusive"]


class Violation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rule_id: str = Field(description="Brand rule code, e.g. BR001")
    category: str
    severity: RuleSeverity
    title: str
    explanation: str
    evidence: str = ""
    recommendation: str
    confidence: float = Field(ge=0.0, le=1.0)
    rule_uuid: Optional[str] = Field(
        default=None, description="Brand rule DB id, if the rule was matched"
    )


class CheckItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rule_id: str
    category: str
    state: CheckState
    detail: str = ""
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    rule_uuid: Optional[str] = None


class ReportMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid")

    engine: str
    is_mock: bool
    model: Optional[str] = None
    vision_observations: list[dict[str, Any]] = Field(default_factory=list)
    ocr_text: str = ""
    ocr_source: Optional[str] = None
    duration_ms: Optional[int] = None
    brand_rules_count: Optional[int] = None
    notes: str = ""


class AnalysisReport(BaseModel):
    """Canonical analysis report persisted to `analysis.report` and exported."""

    model_config = ConfigDict(extra="forbid")

    analysis_id: str
    status: Literal["completed", "failed"]
    compliance_score: Optional[int] = Field(default=None, ge=0, le=100)
    overall_status: Literal[
        "passed", "needs_revision", "critical_failure", "inconclusive", "failed"
    ]
    summary: str
    violations: list[Violation] = Field(default_factory=list)
    passed_checks: list[CheckItem] = Field(default_factory=list)
    inconclusive_checks: list[CheckItem] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    analysis_metadata: ReportMetadata


class VisionObservation(BaseModel):
    """Structured output of the vision engine (real or mock)."""

    model_config = ConfigDict(extra="allow")

    subject: str = ""
    attribute: str = ""
    value: str = ""
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
