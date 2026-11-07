"""Vision engine interface.

Production mode: sends the advertisement image to the configured NVIDIA NIM Vision API
(e.g. nvidia/nemotron-3.5-super-vl-120b-a12b).
Fallback / local development: Ollama Vision SLM or labelled mock.
"""
from __future__ import annotations

import base64
import mimetypes
import os
from pathlib import Path
from typing import Any

from app.config import settings
from app.engine.base import NotConfiguredError


def is_configured() -> bool:
    if settings.VISION_PROVIDER == "nvidia_nim":
        return bool(settings.NVIDIA_API_KEY)
    return bool(settings.OLLAMA_VISION_MODEL)


def not_configured_reason() -> str | None:
    if settings.VISION_PROVIDER == "nvidia_nim":
        if not settings.NVIDIA_API_KEY:
            return "NVIDIA_API_KEY is not set — NVIDIA Vision API not connected."
        return None
    if not settings.OLLAMA_VISION_MODEL:
        return "OLLAMA_VISION_MODEL is not set — Vision SLM not connected yet."
    return None


def mock_observations() -> dict:
    """Clearly-labelled placeholder visual context used by the mock pipeline."""
    return {
        "engine": "mock",
        "is_mock": True,
        "note": "Placeholder visual context — no image inference has been performed.",
        "observations": [],
    }


def analyze_image(
    image_path: str | Path,
    *,
    company_name: str = "Company",
    rules: list[dict[str, Any]] | None = None,
    mock: bool = False,
) -> dict:
    """Observe and analyze the advertisement image.

    Args:
        image_path: absolute path to the stored upload.
        company_name: Name of the company for contextual rule evaluation.
        rules: Optional company brand rules.
        mock: when True, return the labelled placeholder instead of inferring.

    Returns a dict with visual observations and verification details.
    """
    if mock or settings.PIPELINE_MODE == "mock":
        return mock_observations()

    reason = not_configured_reason()
    if reason:
        raise NotConfiguredError(reason)

    path = Path(image_path)
    if not path.is_file():
        raise NotConfiguredError(f"Vision engine received a missing image path: {image_path}")

    # 1. Primary: NVIDIA NIM Vision Engine
    if settings.VISION_PROVIDER == "nvidia_nim":
        from app.services.nvidia_vision_service import analyze_advertisement_image

        result = analyze_advertisement_image(
            image_path=path,
            company_name=company_name,
            rules=rules or [],
        )
        return result

    # 2. Local Ollama fallback
    from app.services import ollama_service

    with open(path, "rb") as fh:
        b64 = base64.b64encode(fh.read()).decode("ascii")

    prompt = (
        "You are a brand-governance analyst. Describe ONLY what is visible in this "
        "advertisement image as neutral visual facts (layout, text blocks, logos, "
        "colors, contact details). Do not judge compliance. Return JSON: "
        '{"observations": [{"subject": str, "attribute": str, "value": str, '
        '"confidence": 0.0-1.0}]}'
    )

    raw = ollama_service.generate(prompt=prompt, image_b64=b64, images=[b64])
    parsed = ollama_service.parse_json_loose(raw)
    return {
        "engine": settings.OLLAMA_VISION_MODEL,
        "is_mock": False,
        "observations": parsed.get("observations", []) if isinstance(parsed, dict) else [],
        "note": "",
    }
