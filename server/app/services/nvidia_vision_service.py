"""NVIDIA NIM Vision Service — Production Multimodal AI Compliance Engine.

Communicates with NVIDIA's hosted NIM Vision models (e.g. nvidia/nemotron-3.5-super-vl-120b-a12b)
to analyze actual advertisement banner images against corporate brand rules, discount ceilings,
and mandatory disclosures.
"""
from __future__ import annotations

import base64
import json
import mimetypes
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

import json_repair

from app.config import settings


class NvidiaVisionError(Exception):
    """Raised when the NVIDIA Vision API fails or cannot be reached."""
    pass


SYSTEM_PROMPT = """You are an expert AI Advertising Compliance & Brand Governance Inspector for Inkloom AI.
Your job is to thoroughly inspect advertisement banner images and evaluate them against company brand rules.

Analyze the ACTUAL VISIBLE IMAGE CONTENT thoroughly, including:
1. Company name and branding (logos, wordmarks, visual identity).
2. Product or service names.
3. Promotional offers and sale slogans.
4. Discount percentages (e.g. "40% off", "75% off").
5. Dates, deadlines, and validity periods.
6. Pricing information, currency symbols, and fees.
7. Contact information (phone, email, website, social handles).
8. Terms and conditions, asterisks, and fine print.
9. Spelling and grammatical errors.
10. Required disclaimers (e.g., dairy allergen notice, financial licensing, health/safety).
11. Company-specific restrictions or prohibited claims.

EVALUATION RULES:
For every provided company rule, assign a status:
- PASS: The rule is satisfied with verifiable evidence in the ad.
- FAIL: The rule is clearly breached (e.g., promotional discount exceeds limit, prohibited claim used).
- UNCERTAIN: The requirement cannot be verified with certainty from the image, or fine print is missing/illegible.

FINAL DECISION:
- APPROVED: The advertisement satisfies all mandatory company requirements and has no unresolved critical issues.
- REJECTED: The advertisement violates one or more mandatory company rules.
- NEEDS REVIEW: The model cannot confidently verify certain mandatory information or needs human review.

COMPLIANCE SCORE:
- An integer from 0 to 100 based on rules passed vs failed/uncertain and issue severity.

IMPORTANT: Never state that an advertisement is factually or legally verified beyond what the provided image and explicit rules establish.

Respond in STRICT JSON format with keys:
{
  "extracted_text": str,
  "detected_company_name": str or null,
  "detected_offers": [str],
  "detected_discounts": [str],
  "detected_dates": [str],
  "detected_pricing": [str],
  "branding_elements": [str],
  "spelling_grammar_issues": [str],
  "missing_required_info": [str],
  "inconsistencies": [str],
  "rule_evaluations": [
    {
      "rule_id": str,
      "rule_text": str,
      "status": "PASS" | "FAIL" | "UNCERTAIN",
      "explanation": str,
      "evidence": str,
      "severity": "CRITICAL" | "MAJOR" | "MINOR" | "INFO"
    }
  ],
  "final_decision": "APPROVED" | "REJECTED" | "NEEDS REVIEW",
  "compliance_score": int,
  "summary": str,
  "recommendations": [str]
}
Return JSON ONLY. No markdown ticks, no preamble."""


def analyze_advertisement_image(
    image_path: str | Path,
    company_name: str,
    rules: list[dict[str, Any]],
    *,
    timeout: float | None = None,
) -> dict[str, Any]:
    """Inspect an advertisement banner image using the paid NVIDIA NIM Vision Model.

    Args:
        image_path: Filesystem path to the stored advertisement image.
        company_name: Name of the company/brand.
        rules: List of rule dicts with keys (code/rule_id, requirement/rule, category, severity).
        timeout: Request timeout in seconds.

    Returns:
        Structured analysis dictionary.

    Raises:
        NvidiaVisionError: If NVIDIA API key is missing, network error, or model failure.
    """
    api_key = settings.NVIDIA_API_KEY
    if not api_key:
        raise NvidiaVisionError(
            "NVIDIA_API_KEY is not configured in the server environment. "
            "Please configure a valid NVIDIA API key in server/.env."
        )

    path = Path(image_path)
    if not path.is_file():
        raise NvidiaVisionError(f"Advertisement image file not found at path: {image_path}")

    # Read image and encode as base64
    try:
        mime_type = mimetypes.guess_type(str(path))[0] or "image/png"
        with open(path, "rb") as f:
            b64_data = base64.b64encode(f.read()).decode("ascii")
    except Exception as e:
        raise NvidiaVisionError(f"Failed to read image file: {e}") from e

    # Build governing rules representation
    formatted_rules = []
    for r in rules:
        rule_id = r.get("code") or r.get("rule_id") or r.get("id") or "RULE"
        requirement = r.get("requirement") or r.get("rule") or r.get("description") or str(r)
        severity = r.get("severity") or "CRITICAL"
        category = r.get("category") or "general"
        formatted_rules.append({
            "rule_id": str(rule_id),
            "rule": str(requirement),
            "category": str(category),
            "severity": str(severity).upper(),
        })

    user_prompt = (
        f"COMPANY / BRAND: {company_name}\n\n"
        f"GOVERNING BRAND RULES & REGULATIONS:\n"
        f"{json.dumps(formatted_rules, indent=2)}\n\n"
        "Inspect this advertisement image thoroughly and evaluate it against every governing rule above."
    )

    model_name = settings.NVIDIA_VISION_MODEL or "nvidia/nemotron-3.5-super-vl-120b-a12b"
    endpoint = f"{settings.NVIDIA_BASE_URL.rstrip('/')}/chat/completions"
    req_timeout = timeout or settings.NVIDIA_TIMEOUT_SECONDS

    payload = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": user_prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime_type};base64,{b64_data}"},
                    },
                ],
            },
        ],
        "max_tokens": 6144,
        "temperature": 0.1,
    }

    req = urllib.request.Request(
        endpoint,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        data=json.dumps(payload).encode("utf-8"),
    )

    try:
        with urllib.request.urlopen(req, timeout=req_timeout) as resp:
            raw_response = resp.read().decode("utf-8")
            res_json = json.loads(raw_response)
    except urllib.error.HTTPError as http_err:
        try:
            err_body = http_err.read().decode("utf-8", errors="replace")
        except Exception:
            err_body = str(http_err)
        raise NvidiaVisionError(
            f"NVIDIA API HTTP {http_err.code} error on model '{model_name}': {err_body}"
        ) from http_err
    except urllib.error.URLError as url_err:
        raise NvidiaVisionError(
            f"Failed to connect to NVIDIA Vision API at {endpoint}: {url_err.reason}"
        ) from url_err
    except Exception as exc:
        raise NvidiaVisionError(f"Unexpected error communicating with NVIDIA Vision API: {exc}") from exc

    # Extract assistant message content
    try:
        choices = res_json.get("choices", [])
        if not choices:
            raise NvidiaVisionError("NVIDIA Vision API returned empty choices list.")
        choice = choices[0]
        finish_reason = choice.get("finish_reason")
        usage = res_json.get("usage", {})
        print(f"[NVIDIA USAGE]: finish_reason={finish_reason}, usage={usage}", flush=True)
        message = choice.get("message", {})
        raw_content = message.get("content") or ""
        if not raw_content.strip():
            # Sometimes reasoning models output in reasoning_content or alternative keys
            raw_content = message.get("reasoning_content") or ""
        if not raw_content.strip():
            raise NvidiaVisionError("NVIDIA Vision API returned empty response content.")
        Path(r"C:\Users\SHIVAM\OneDrive\Desktop\commit-deck\debug_raw_content.txt").write_text(raw_content, encoding="utf-8")
    except Exception as e:
        if isinstance(e, NvidiaVisionError):
            raise
        raise NvidiaVisionError(f"Failed to parse NVIDIA API response structure: {e}") from e

    # Parse and repair JSON
    try:
        cleaned = raw_content.strip()
        if "```json" in cleaned:
            cleaned = cleaned.split("```json", 1)[1].split("```", 1)[0]
        elif "```" in cleaned:
            parts = cleaned.split("```")
            if len(parts) >= 2:
                cleaned = parts[1]
                if cleaned.startswith("json"):
                    cleaned = cleaned[4:]
        elif "{" in cleaned and "}" in cleaned:
            start = cleaned.find("{")
            end = cleaned.rfind("}") + 1
            cleaned = cleaned[start:end]

        parsed = None
        # Attempt 1: Standard json.loads
        try:
            parsed = json.loads(cleaned.strip())
        except Exception:
            pass

        # Attempt 2: Fix unescaped/overescaped quotes in json.loads
        if not isinstance(parsed, dict) or "rule_evaluations" not in parsed:
            try:
                p2 = json.loads(cleaned.strip().replace('\\"', '"'))
                if isinstance(p2, dict) and "rule_evaluations" in p2:
                    parsed = p2
            except Exception:
                pass

        # Attempt 3: json_repair on cleaned
        if not isinstance(parsed, dict) or "rule_evaluations" not in parsed:
            try:
                p3 = json_repair.loads(cleaned.strip())
                if isinstance(p3, dict) and "rule_evaluations" in p3:
                    parsed = p3
            except Exception:
                pass

        # Attempt 4: json_repair with fixed quotes
        if not isinstance(parsed, dict) or "rule_evaluations" not in parsed:
            try:
                p4 = json_repair.loads(cleaned.strip().replace('\\"', '"'))
                if isinstance(p4, dict):
                    parsed = p4
            except Exception:
                pass

        if not isinstance(parsed, dict):
            parsed = json_repair.loads(cleaned.strip())

        if isinstance(parsed, list) and parsed and isinstance(parsed[0], dict):
            parsed = parsed[0]
        if not isinstance(parsed, dict):
            # Fallback attempt: find any JSON object substring in raw_content
            if "{" in raw_content and "}" in raw_content:
                s = raw_content.find("{")
                e = raw_content.rfind("}") + 1
                fallback_parsed = json_repair.loads(raw_content[s:e])
                if isinstance(fallback_parsed, dict):
                    parsed = fallback_parsed
                else:
                    raise ValueError("Model output parsed into non-dict structure.")
            else:
                raise ValueError("Model output parsed into non-dict structure.")
    except Exception as err:
        raise NvidiaVisionError(
            f"NVIDIA Vision model produced malformed JSON response: {err}. Raw: {raw_content[:200]}"
        ) from err

    # Normalize fields and enforce schema
    rule_evals = list(parsed.get("rule_evaluations", []))
    failed_count = sum(
        1 for e in rule_evals if str(e.get("status", "")).upper() == "FAIL"
    )
    uncertain_count = sum(
        1 for e in rule_evals if str(e.get("status", "")).upper() == "UNCERTAIN"
    )

    final_decision = str(parsed.get("final_decision", "")).upper()
    if failed_count > 0:
        final_decision = "REJECTED"
    elif final_decision not in ("APPROVED", "REJECTED", "NEEDS REVIEW"):
        if uncertain_count > 0:
            final_decision = "NEEDS REVIEW"
        else:
            final_decision = "APPROVED"

    compliance_score = parsed.get("compliance_score")
    if compliance_score is None:
        if failed_count > 0:
            compliance_score = max(0, 100 - (failed_count * 30))
        elif uncertain_count > 0:
            compliance_score = max(50, 100 - (uncertain_count * 15))
        else:
            compliance_score = 100
    else:
        compliance_score = int(compliance_score)
        if failed_count > 0 and compliance_score > 30:
            compliance_score = 0

    return {
        "engine": model_name,
        "is_mock": False,
        "extracted_text": str(parsed.get("extracted_text", "")),
        "detected_company_name": parsed.get("detected_company_name"),
        "detected_offers": list(parsed.get("detected_offers", [])),
        "detected_discounts": list(parsed.get("detected_discounts", [])),
        "detected_dates": list(parsed.get("detected_dates", [])),
        "detected_pricing": list(parsed.get("detected_pricing", [])),
        "branding_elements": list(parsed.get("branding_elements", [])),
        "spelling_grammar_issues": list(parsed.get("spelling_grammar_issues", [])),
        "missing_required_info": list(parsed.get("missing_required_info", [])),
        "inconsistencies": list(parsed.get("inconsistencies", [])),
        "rule_evaluations": list(parsed.get("rule_evaluations", [])),
        "final_decision": final_decision,
        "compliance_score": int(parsed.get("compliance_score", 0 if final_decision == "REJECTED" else 100)),
        "summary": str(parsed.get("summary", "Analysis completed.")),
        "recommendations": list(parsed.get("recommendations", [])),
    }
