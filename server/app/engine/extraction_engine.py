"""Brand-rule extraction engine.

Turns a company's *original* guideline text into proposed structured rules.
The model is never allowed to invent a rule: every proposal must include a
`source_text` that appears verbatim (whitespace-normalised) in the source
document. Proposals that fail validation are reported as rejected, not saved.
"""
from __future__ import annotations

import json
import re
from typing import Any

from app.config import settings

ALLOWED_CATEGORIES = (
    "logo",
    "typography",
    "colour_palette",
    "messaging",
    "advertising_claims",
    "restricted_content",
    "legal_compliance",
    "general",
)
ALLOWED_SEVERITIES = ("critical", "major", "minor", "info")


def _norm(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "")).strip().lower()


def build_prompt(source_text: str) -> tuple[str, str]:
    """(system, user) prompt for strict JSON rule extraction."""
    system = (
        "You are the Inkloom Brand Rule Extractor. You convert a company's brand "
        "guidelines into structured, machine-checkable compliance rules. "
        "You must NEVER invent, generalise beyond, or reinterpret the source. "
        "Each rule must be directly supported by an exact quote from the source. "
        "Respond with strict JSON only, no markdown:\n"
        '{"rules":[{"category":"logo|typography|colour_palette|messaging|'
        'advertising_claims|restricted_content|legal_compliance|general",'
        '"requirement":"one clear testable instruction",'
        '"severity":"critical|major|minor|info",'
        '"source_text":"exact verbatim quote from the source",'
        '"confidence":0.0}]}'
    )
    trimmed = source_text[: settings.EXTRACTION_MAX_CHARS]
    user = (
        "Extract every explicit brand/advertising rule from the document below.\n"
        "Rules:\n"
        "1. Split compound requirements into one rule each.\n"
        "2. `source_text` MUST be copied character-for-character from the document "
        "(a sentence or clause; do not paraphrase).\n"
        "3. If a statement is aspirational rather than testable, skip it.\n"
        "4. Use `critical` only for legal/prohibited-content requirements.\n"
        f"5. Return at most {settings.EXTRACTION_MAX_RULES} rules.\n"
        "6. If there are no explicit rules, return {\"rules\":[]}.\n\n"
        "DOCUMENT:\n"
        f"{trimmed}"
    )
    return system, user


def _as_confidence(value: Any) -> float:
    try:
        return max(0.0, min(1.0, float(value)))
    except (TypeError, ValueError):
        return 0.0


def validate_proposals(
    raw: Any, source_text: str, *, max_rules: int | None = None
) -> tuple[list[dict], list[dict], list[str]]:
    """Validate loose model output against the source document.

    Returns (proposals, rejected, warnings). Never raises on malformed input.
    """
    warnings: list[str] = []
    rejected: list[dict] = []
    proposals: list[dict] = []

    if isinstance(raw, list):
        items = raw
    elif isinstance(raw, dict):
        items = raw.get("rules") or raw.get("proposed_rules") or []
    else:
        items = []

    if not isinstance(items, list):
        return [], [{"reason": "model returned a non-list rules field"}], [
            "Model output had an unexpected shape."
        ]

    source_norm = _norm(source_text)
    seen: set[str] = set()
    limit = max_rules or settings.EXTRACTION_MAX_RULES

    for index, item in enumerate(items):
        if not isinstance(item, dict):
            rejected.append({"index": index, "reason": "not an object"})
            continue

        requirement = str(item.get("requirement") or item.get("rule") or "").strip()
        quote = str(item.get("source_text") or item.get("source") or "").strip()
        category = str(item.get("category") or "general").strip().lower()
        category = re.sub(r"[\s-]+", "_", category)
        if category not in ALLOWED_CATEGORIES:
            category = "general"
        severity = str(item.get("severity") or "major").strip().lower()
        if severity not in ALLOWED_SEVERITIES:
            severity = "major"

        if not requirement:
            rejected.append({"index": index, "reason": "missing requirement"})
            continue
        if len(requirement) < 5:
            rejected.append({"index": index, "requirement": requirement, "reason": "requirement too short"})
            continue
        if not quote:
            rejected.append({"index": index, "requirement": requirement, "reason": "missing source_text"})
            continue
        if _norm(quote) not in source_norm:
            rejected.append(
                {
                    "index": index,
                    "requirement": requirement,
                    "reason": "source_text is not a verbatim quote from the document",
                }
            )
            continue

        dedupe_key = _norm(requirement)
        if dedupe_key in seen:
            rejected.append({"index": index, "requirement": requirement, "reason": "duplicate rule"})
            continue
        seen.add(dedupe_key)

        if len(proposals) >= limit:
            warnings.append(f"Rule limit of {limit} reached; remaining proposals were dropped.")
            break

        proposals.append(
            {
                "proposal_id": f"prop_{len(proposals) + 1:03d}",
                "category": category,
                "requirement": requirement[:4000],
                "severity": severity,
                "source_text": quote[:8000],
                "confidence": _as_confidence(item.get("confidence")),
            }
        )

    if not proposals:
        warnings.append("No valid rules were proposed. Review the source text or retry.")

    return proposals, rejected, warnings


def parse_model_output(raw_text: str) -> Any:
    """Parse JSON tolerantly (raw, fenced, or first object)."""
    raw = (raw_text or "").strip()
    if not raw:
        raise ValueError("Empty model response")
    try:
        return json.loads(raw)
    except Exception:
        pass
    blocks = re.findall(r"```(?:json)?\s*(.+?)```", raw, re.S)
    for block in blocks:
        try:
            return json.loads(block)
        except Exception:
            continue
    start, end = raw.find("{"), raw.rfind("}") + 1
    if start >= 0 and end > start:
        return json.loads(raw[start:end])
    raise ValueError("Model response is not valid JSON")
