"""Ad Compliance Verification Engine.

Performs deterministic & AI compliance verification on ad headlines and copy
against company rules, discount ceilings, and mandatory disclosures.
"""
from __future__ import annotations

import re
from typing import Any, Optional


def verify_ad_compliance(
    *,
    company_name: str,
    rules: list[str],
    ad_headline: str,
    ad_copy: str,
    media_metrics: Optional[dict[str, Any]] = None,
    text_metrics: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Verify ad headline and copy against corporate compliance rules.

    Detects:
    - Numeric limit breaches (e.g. discount cap breaches).
    - Missing mandatory disclosures (e.g. dairy allergen disclaimer, financial licensing).
    - Prohibited claims and terms.

    Returns:
    {
        "status": "COMPLIANT" | "NON_COMPLIANT",
        "total_violations": int,
        "violations": list[dict]
    }
    """
    violations: list[dict[str, Any]] = []
    combined_ad_text = f"{ad_headline or ''} {ad_copy or ''}".strip()
    ad_lower = combined_ad_text.lower()

    # Normalize rules into individual checkable clauses while preserving the source text
    normalized_rules: list[tuple[str, str]] = []
    for raw_rule in rules:
        if not raw_rule or not raw_rule.strip():
            continue
        cleaned = raw_rule.strip()
        # Split on semicolons or newlines if present
        parts = [p.strip() for p in re.split(r"[;\n]+", cleaned) if p.strip()]
        if len(parts) > 1:
            for part in parts:
                normalized_rules.append((part, cleaned))
        else:
            normalized_rules.append((cleaned, cleaned))

    # Extract all discount claims in the ad copy/headline
    claimed_percentages: list[int] = []
    pct_patterns = [
        r"(\d{1,3})%\s*(?:off|discount|sale|savings|cashback|price reduction)",
        r"(?:save|up to|get|enjoy)\s*(\d{1,3})%",
        r"(\d{1,3})%\s*(?:cut|rebate)",
    ]
    for pattern in pct_patterns:
        for match in re.finditer(pattern, combined_ad_text, re.IGNORECASE):
            claimed_percentages.append(int(match.group(1)))

    if not claimed_percentages:
        for match in re.finditer(r"(\d{1,3})%", combined_ad_text):
            val = int(match.group(1))
            if any(k in ad_lower for k in ["off", "discount", "sale", "save", "deal", "scoops"]):
                claimed_percentages.append(val)

    processed_violations: set[str] = set()

    for clause, original_rule in normalized_rules:
        clause_lower = clause.lower()

        # 1. Numeric discount limit check
        limit_match = (
            re.search(r"(?:maximum|max)?\s*(?:promotional\s*)?discount[^\d]*?(\d{1,3})%", clause, re.IGNORECASE)
            or re.search(r"discount[s]?\s*(?:cannot exceed|must not exceed|capped at|up to|maximum|max of)?\s*(\d{1,3})%", clause, re.IGNORECASE)
            or re.search(r"(?:limit|cap)\s*(?:promotional\s*)?discounts?\s*(?:to|at)?\s*(\d{1,3})%", clause, re.IGNORECASE)
            or re.search(r"no\s*discounts?\s*(?:greater than|over|above|exceeding)\s*(\d{1,3})%", clause, re.IGNORECASE)
        )

        if limit_match:
            allowed_max = int(limit_match.group(1))
            for claimed in claimed_percentages:
                if claimed > allowed_max:
                    violation_key = f"NUMERIC_LIMIT_EXCEEDED_{allowed_max}_{claimed}"
                    if violation_key not in processed_violations:
                        processed_violations.add(violation_key)
                        violations.append({
                            "rule": clause,
                            "violation_type": "NUMERIC_LIMIT_EXCEEDED",
                            "explanation": f"Ad copy advertises {claimed}% off, breaching the {allowed_max}% limit.",
                            "severity": "CRITICAL",
                        })

        # 2. Mandatory disclaimer / disclosure check
        is_disclosure_rule = any(
            k in clause_lower for k in [
                "must include", "mandatory", "required", "require", "must contain", "all ads must"
            ]
        ) and any(
            k in clause_lower for k in [
                "disclaimer", "disclosure", "notice", "warning", "allergen", "licensing"
            ]
        )

        if is_disclosure_rule:
            # Dairy allergen disclaimer check
            if any(k in clause_lower for k in ["dairy", "allergen", "lactose", "milk"]):
                has_dairy_disclosure = any(
                    k in ad_lower for k in [
                        "dairy", "milk", "contains dairy", "dairy disclosure",
                        "allergen", "lactose", "contains milk"
                    ]
                )
                if not has_dairy_disclosure:
                    violation_key = "MISSING_DAIRY_DISCLOSURE"
                    if violation_key not in processed_violations:
                        processed_violations.add(violation_key)
                        violations.append({
                            "rule": clause,
                            "violation_type": "MISSING_MANDATORY_DISCLOSURE",
                            "explanation": "Ad copy lacks the required dairy allergen disclaimer.",
                            "severity": "CRITICAL",
                        })

            # Financial licensing disclosure check
            elif any(k in clause_lower for k in ["licensing", "financial license", "financial licensing", "fdic", "finra", "sec"]):
                has_licensing_disclosure = any(
                    k in ad_lower for k in [
                        "licensed", "licensing", "financial license", "regulated",
                        "member finra", "fdic", "authorized", "licensing disclosure"
                    ]
                )
                if not has_licensing_disclosure:
                    violation_key = "MISSING_LICENSING_DISCLOSURE"
                    if violation_key not in processed_violations:
                        processed_violations.add(violation_key)
                        violations.append({
                            "rule": clause,
                            "violation_type": "MISSING_MANDATORY_DISCLOSURE",
                            "explanation": "Ad copy lacks the required financial licensing disclosure.",
                            "severity": "CRITICAL",
                        })

            # General mandatory disclaimer
            else:
                match_disc = re.search(
                    r"(?:must include|must contain|mandatory|require[s]?)\s+(?:a |an )?([a-zA-Z0-9\s-]+?)(?:\s+disclaimer|\s+disclosure|\s+notice|\s+warning|$)",
                    clause,
                    re.IGNORECASE,
                )
                term = match_disc.group(1).strip() if match_disc else "mandatory disclaimer"
                term_words = [w for w in term.lower().split() if len(w) > 3]
                if not any(w in ad_lower for w in term_words):
                    violation_key = f"MISSING_{term.upper()}"
                    if violation_key not in processed_violations:
                        processed_violations.add(violation_key)
                        violations.append({
                            "rule": clause,
                            "violation_type": "MISSING_MANDATORY_DISCLOSURE",
                            "explanation": f"Ad copy lacks the required {term} disclaimer.",
                            "severity": "CRITICAL",
                        })

        # 3. Prohibited claims / words
        prohibit_match = re.search(
            r"(?:never claim|cannot claim|prohibit[s]?|do not use|unapproved claim[s]?)\s+[\"']?([^\"'\n.;]+)[\"']?",
            clause,
            re.IGNORECASE,
        )
        if prohibit_match:
            banned = prohibit_match.group(1).strip().lower()
            if banned and banned in ad_lower:
                violation_key = f"PROHIBITED_CLAIM_{banned}"
                if violation_key not in processed_violations:
                    processed_violations.add(violation_key)
                    violations.append({
                        "rule": clause,
                        "violation_type": "PROHIBITED_CLAIM",
                        "explanation": f"Ad copy contains prohibited claim: '{banned}'.",
                        "severity": "MAJOR",
                    })

    total_violations = len(violations)
    status = "NON_COMPLIANT" if total_violations > 0 else "COMPLIANT"

    return {
        "status": status,
        "total_violations": total_violations,
        "violations": violations,
    }
