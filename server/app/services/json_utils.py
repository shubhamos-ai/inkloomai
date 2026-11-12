"""Tolerant parsing helpers for model-generated JSON.

Providers occasionally stop mid-object when they hit the completion budget.
Instead of discarding an otherwise useful response, salvage every complete
object and let the deterministic validator mark anything missing as
inconclusive.
"""
from __future__ import annotations

import json
import re
from collections.abc import Iterator
from typing import Any


def _iter_complete_objects(raw: str) -> Iterator[str]:
    """Yield complete JSON objects from a (possibly truncated) document.

    Tracks strings, escapes and brace depth so braces inside quoted text do not
    confuse the scan. A truncated trailing object is ignored.
    """
    first = raw.find("{")
    first_array = raw.find("[")
    if first < 0 and first_array < 0:
        return

    # Root may be an object or an array; objects sit one level below the root.
    root_is_array = first_array >= 0 and (first < 0 or first_array < first)
    target_depth = 1 if root_is_array else 2

    depth = 0
    in_string = False
    escaped = False
    object_start: int | None = None

    for index, char in enumerate(raw):
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue

        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
            if depth == target_depth:
                object_start = index
        elif char == "}":
            if depth == target_depth and object_start is not None:
                yield raw[object_start : index + 1]
                object_start = None
            depth = max(0, depth - 1)


def _decode_string(value: str) -> str:
    try:
        return json.loads(f'"{value}"')
    except Exception:
        return value


def salvage_partial_json(raw: str) -> dict[str, Any] | None:
    """Rebuild a report-like dict from complete objects in truncated output.

    Returns ``None`` when nothing usable can be recovered, so callers can keep
    their existing error handling.
    """
    if not raw or not raw.strip():
        return None

    summary = ""
    match = re.search(r'"summary"\s*:\s*"((?:[^"\\]|\\.)*)"', raw, re.S)
    if match:
        summary = _decode_string(match.group(1)).strip()

    checks: list[dict[str, Any]] = []
    violations: list[dict[str, Any]] = []
    for chunk in _iter_complete_objects(raw):
        try:
            obj = json.loads(chunk)
        except Exception:
            continue
        if not isinstance(obj, dict):
            continue
        if "state" in obj:
            checks.append(obj)
        elif "explanation" in obj or "evidence" in obj or "title" in obj:
            violations.append(obj)

    recommendations: list[str] = []
    rec_match = re.search(r'"recommendations"\s*:\s*\[(.*?)(?:\]|$)', raw, re.S)
    if rec_match:
        for value in re.findall(r'"((?:[^"\\]|\\.)*)"', rec_match.group(1)):
            text = _decode_string(value).strip()
            if text:
                recommendations.append(text)

    if not (summary or checks or violations or recommendations):
        return None

    salvaged: dict[str, Any] = {}
    if summary:
        salvaged["summary"] = summary
    if checks:
        salvaged["checks"] = checks
    if violations:
        salvaged["violations"] = violations
    if recommendations:
        salvaged["recommendations"] = recommendations
    return salvaged
