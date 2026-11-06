"""Compliance engine interface.

Compares vision observations + OCR text against the company's enabled brand
rules and produces a validated `AnalysisReport`-compatible draft.

AI mode: builds a strict-prompt request for the local Vision SLM.
Mock mode: marks every enabled rule inconclusive (never fabricates findings).
"""
from __future__ import annotations

import json
import re
from typing import Any

from app.engine import vision_engine
from app.schemas.report import AnalysisReport, Violation

SYSTEM_HINT = (
    "You compare an advertisement against brand rules. For each rule return a "
    "finding with state passed|failed|inconclusive. Never invent rules."
)


def mock_report_draft(
    *,
    analysis_id: str,
    rules: list[dict[str, Any]],
    vision: dict,
    ocr: dict,
    ocr_text: str,
    vision_observations: list,
) -> dict:
    """Draft report for the mock pipeline.

    Every enabled rule is listed as an *inconclusive check* so the whole job
    flow is exercised honestly — the output says 'not evaluated', not 'OK'.
    """
    template = AnalysisReport(
        analysis_id=analysis_id,
        status="completed",
        compliance_score=None,
        overall_status="inconclusive",
        summary=(
            "MOCK ANALYSIS — this is placeholder output for infrastructure testing. "
            "No AI inference has been performed yet; every rule was left inconclusive."
        ),
        violations=[],
        passed_checks=[],
        inconclusive_checks=[],
        recommendations=[
            "Mock pipeline run only — connect the Vision SLM to get real compliance results."
        ],
        analysis_metadata={
            "engine": "mock",
            "is_mock": True,
            "vision_observations": vision_observations,
            "ocr_text": ocr_text,
            "notes": f"{vision.get('note', '')} {ocr.get('note', '')}".strip(),
        },
    )
    return template.model_dump(mode="json") | {
        "inconclusive_checks": [
            {
                "rule_id": r["code"],
                "category": r["category"],
                "state": "inconclusive",
                "detail": "Not evaluated — mock pipeline run.",
                "confidence": 0.0,
                "rule_uuid": r["id"],
            }
            for r in rules
        ],
        # keep the checked-order stable for deterministic output
    }


def build_prompt(rules: list[dict[str, Any]], vision: dict, ocr_text: str) -> tuple[str, str]:
    """(system, user) prompt pair for the real AI compliance pass."""
    rules_json = json.dumps(
        [
            {
                "rule_id": r["code"],
                "uuid": r["id"],
                "category": r["category"],
                "requirement": r["requirement"],
                "severity": r["severity"],
            }
            for r in rules
        ],
        indent=2,
    )
    system = (
        SYSTEM_HINT
        + " Respond with strict JSON only:\n"
        '{"summary": str, "violations": [{"rule_id": str, "category": str, "severity": '
        '"critical|major|minor|info", "title": str, "explanation": str, '
        '"evidence": str, "recommendation": str, "confidence": 0-1, "rule_uuid": str}], '
        '"checks": [{"rule_id": str, "category": str, "state": "passed|failed|inconclusive", '
        '"detail": str, "confidence": 0-1, "rule_uuid": str}], "recommendations": [str]}'
    )
    user = (
        f"BRAND RULES:\n{rules_json}\n\n"
        f"VISUAL OBSERVATIONS:\n{json.dumps(vision.get('observations', []), indent=2)}\n\n"
        f"TEXT DETECTED IN THE ADVERTISEMENT:\n{ocr_text or '(no text extracted)'}\n\n"
        "Evaluate EVERY brand rule listed above, one by one. For EACH rule include one "
        "entry in \"checks\" with state passed, failed or inconclusive. Never omit any rule. "
        "Rules you cannot verify from the image must be marked inconclusive. Findings in "
        "\"violations\" must reference the exact rule_id."
    )
    return system, user


def _norm_rule_key(value: str) -> str:
    """Uppercase alphanumeric key for tolerant rule matching."""
    return re.sub(r"[^A-Za-z0-9]", "", str(value)).upper()


def _canonical_code(value: str) -> str | None:
    """Extract 'BR<n>' and zero-pad to BR001 form."""
    m = re.search(r"BR\s*-?\s*(\d{1,4})", str(value), re.I)
    if not m:
        return None
    return f"BR{int(m.group(1)):03d}"


def _match_rule(finding: dict, known_by_code: dict, known_by_uuid: dict):
    """Tolerantly map a model finding to our rule dict.

    Accepts the exact code (BR001), the rule uuid, or fuzzy variants such as
    "br-002", "BR2." Returns None when the finding references an unknown rule.
    """
    for field in ("rule_id", "rule_uuid", "rule", "code"):
        value = str(finding.get(field, "")).strip()
        if not value:
            continue
        if value in known_by_uuid:
            return known_by_uuid[value]
        norm = _norm_rule_key(value)
        if norm in known_by_code:
            return known_by_code[norm]
        canonical = _canonical_code(value)
        if canonical and canonical in known_by_code:
            return known_by_code[canonical]
    return None


def validate_ai_output(
    *, raw: dict, analysis_id: str, rules: list[dict[str, Any]], metadata_extra: dict
) -> dict:
    """Turn loose model JSON into a validated report dict.

    Malformed/partial AI output degrades to inconclusive — never to fabrications.
    """
    try:
        known_by_code = {_norm_rule_key(r["code"]): r for r in rules}
        known_by_uuid = {r["id"]: r for r in rules}

        checks: list[dict] = []
        for c in raw.get("checks", []) if isinstance(raw.get("checks"), list) else []:
            try:
                rule = _match_rule(c, known_by_code, known_by_uuid)
                if not rule:
                    continue
                try:
                    confidence = max(0.0, min(1.0, float(c.get("confidence", 0.0))))
                except (TypeError, ValueError):
                    confidence = 0.0
                state = c.get("state")
                if state not in ("passed", "failed", "inconclusive"):
                    state = "inconclusive"  # unsupported states degrade safely
                checks.append(
                    {
                        "rule_id": rule["code"],
                        "category": rule["category"],
                        "state": state,
                        "detail": c.get("detail", ""),
                        "confidence": confidence,
                        "rule_uuid": rule["id"],
                    }
                )
            except Exception:  # invalid single check -> skip it
                continue

        violations: list[dict] = []
        for v in raw.get("violations", []) if isinstance(raw.get("violations"), list) else []:
            try:
                rule = _match_rule(v, known_by_code, known_by_uuid)
                if not rule:
                    continue
                try:
                    confidence = max(0.0, min(1.0, float(v.get("confidence", 0.5))))
                except (TypeError, ValueError):
                    confidence = 0.5
                severities = ("critical", "major", "minor", "info")
                raw_sev = v.get("severity")
                if raw_sev not in severities:
                    raw_sev = rule.get("severity") if rule.get("severity") in severities else "major"
                violations.append(
                    Violation(
                        rule_id=rule["code"],
                        rule_uuid=rule["id"],
                        category=rule["category"],
                        severity=raw_sev,
                        title=v.get("title", "Brand compliance issue"),
                        explanation=v.get("explanation", ""),
                        evidence=v.get("evidence", ""),
                        recommendation=v.get("recommendation", "Review this requirement."),
                        confidence=confidence,
                    ).model_dump(mode="json")
                )
            except Exception:  # invalid single violation -> skip it, report stays valid
                continue

        passed = [c for c in checks if c["state"] == "passed"]
        failed_violations_map = {viol["rule_id"]: viol for viol in violations}

        # A "failed" check without a matching violation entry is still a real
        # finding — synthesise one so deterministic scoring accounts for it.
        for c in checks:
            if c["state"] == "failed" and c["rule_id"] not in failed_violations_map:
                rule = known_by_uuid.get(c["rule_uuid"], {})
                try:
                    syn = Violation(
                        rule_id=c["rule_id"],
                        rule_uuid=c["rule_uuid"],
                        category=rule.get("category", c.get("category", "general")),
                        severity=rule.get("severity", "major"),
                        title=f"Rule {c['rule_id']} not satisfied",
                        explanation=c.get("detail", "") or "Rule marked failed by evaluation.",
                        evidence="",
                        recommendation=(
                            f"Review and fix: {rule.get('requirement', 'see rule')}".rstrip(".") + "."
                        ),
                        confidence=c.get("confidence", 0.5),
                    ).model_dump(mode="json")
                    violations.append(syn)
                    failed_violations_map[c["rule_id"]] = syn
                except Exception:
                    continue

        inconclusive = [
            c
            for c in checks
            if c["state"] == "inconclusive" and c["rule_id"] not in failed_violations_map
        ]

        # Rules never mentioned by the model stay honestly inconclusive.
        for r in rules:
            if r["code"] in failed_violations_map or any(
                c["rule_id"] == r["code"] for c in checks
            ) or any(c["rule_id"] == r["code"] for c in inconclusive):
                continue
            inconclusive.append(
                {
                    "rule_id": r["code"],
                    "category": r["category"],
                    "state": "inconclusive",
                    "detail": "Rule was not addressed by the model output.",
                    "confidence": 0.0,
                    "rule_uuid": r["id"],
                }
            )

        raw_summary = str(raw.get("summary") or "").strip()
        if raw_summary == "":
            raw_summary = (
                "Model returned no conclusive findings for this advertisement."
                if not violations and not passed
                else "Analysis completed."
            )

        return AnalysisReport(
            analysis_id=analysis_id,
            status="completed",
            compliance_score=None,  # scoring_engine decides
            overall_status="inconclusive",
            summary=raw_summary,
            violations=violations,
            passed_checks=passed,
            inconclusive_checks=inconclusive,
            recommendations=[str(x) for x in raw.get("recommendations", []) if x][:20],
            analysis_metadata={
                "engine": rules[0].get("engine_name", "ai") if rules else "ai",
                "is_mock": False,  # real inference output, normalised deterministically
                **metadata_extra,
            },
        ).model_dump(mode="json")
    except Exception:
        # Last-resort safety: never persist malformed model output.
        import traceback

        from app.config import settings as _settings

        if _settings.DEBUG:
            traceback.print_exc()
        return mock_report_draft(
            analysis_id=analysis_id,
            rules=rules,
            vision={"note": "AI output invalid; fell back to inconclusive draft."},
            ocr={},
            ocr_text="",
            vision_observations=vision_engine.mock_observations()["observations"],
        )
