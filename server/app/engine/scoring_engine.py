"""Deterministic scoring engine.

The compliance score is ALWAYS computed here in plain Python from the
validated findings. The LLM never chooses the score.

Deduction weights per confirmed violation amount to a fixed sum bounded at 100;
ties and ordering are deterministic (severity order, then rule code).
"""
from __future__ import annotations

from typing import Optional

SEVERITY_WEIGHTS = {
    "critical": 30,
    "major": 18,
    "minor": 10,
    "info": 4,
}
SEVERITY_RANK = {"critical": 0, "major": 1, "minor": 2, "info": 3}

# A violation below this confidence is treated as inconclusive rather than
# a confirmed failure.
CONFIDENCE_THRESHOLD = 0.5


def score_report(report: dict) -> tuple[Optional[int], str, str]:
    """Compute (compliance_score, overall_status, summary) for a report dict.

    Rules of the game:
    - No conclusive checks at all                 -> inconclusive / null score.
    - All conclusive checks passed                -> 100, passed.
    - Otherwise: 100 - weighted confirmed deductions, clamped to [0, 100].

    overall_status mapping:
        score >= 90 -> passed
        score >= 60 -> needs_revision
        score <  60 -> critical_failure
    """
    violations = report.get("violations", []) or []
    inconclusive = report.get("inconclusive_checks", []) or []
    passed = [(c or {}) for c in (report.get("passed_checks") or []) if c.get("state") == "passed"]

    # A violation is only confirmed when its confidence is above threshold.
    confirmed = [
        v
        for v in violations
        if (v.get("confidence") or 0.0) >= CONFIDENCE_THRESHOLD and v.get("severity")
    ]
    dropped_low_confidence = len(violations) - len(confirmed)

    if not confirmed and not passed:
        return None, "inconclusive", "".join(
            report.get("summary") or "No conclusive compliance checks were performed."
        )

    deduction = sum(SEVERITY_WEIGHTS.get(v["severity"], SEVERITY_WEIGHTS["major"]) for v in confirmed)
    score: Optional[int] = max(0, min(100, 100 - deduction)) if confirmed else 100

    if score >= 90:
        overall = "passed"
    elif score >= 60:
        overall = "needs_revision"
    else:
        overall = "critical_failure"

    summary = build_summary(overall, confirmed, passed, dropped_low_confidence, report.get("summary"))
    return score, overall, summary


def build_summary(overall: str, confirmed: list, passed: list, low_confidence: int, ai_summary: Optional[str]) -> str:
    if overall == "passed":
        base = "Advertisement satisfies all evaluated brand policies."
    elif overall == "needs_revision":
        base = "Advertisement requires brand corrections before publication."
    else:
        base = "Advertisement has critical brand policy violations."

    parts = [f"{len(confirmed)} confirmed violation(s)", f"{len(passed)} check(s) passed"]
    if low_confidence:
        parts.append(f"{low_confidence} low-confidence finding(s) ignored")
    detail = "; ".join(parts)
    suffix = f" ({detail})"
    result = base + suffix
    return ai_summary or result
