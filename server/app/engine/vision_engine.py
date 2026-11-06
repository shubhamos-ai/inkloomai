"""Vision engine interface.

Real mode: sends the advertisement image to the local Ollama Vision SLM
(model tag configured later, e.g. `gemma3:4b`) and returns structured visual
observations. In mock mode it returns a deterministic placeholder so the whole
pipeline can be exercised end-to-end before the model is available.
"""
from __future__ import annotations

import base64
import mimetypes
import os
from pathlib import Path

from app.config import settings
from app.engine.base import NotConfiguredError


def is_configured() -> bool:
    return bool(settings.OLLAMA_VISION_MODEL)


def not_configured_reason() -> str | None:
    if not settings.OLLAMA_VISION_MODEL:
        return "OLLAMA_VISION_MODEL is not set — Vision SLM not connected yet."
    return None


def mock_observations() -> dict:
    """Clearly-labelled placeholder visual context used by the mock pipeline.

    Deliberately generic: it contains no invented detection results."""
    return {
        "engine": "mock",
        "is_mock": True,
        "note": "Placeholder visual context — no image inference has been performed.",
        "observations": [],
    }


def analyze_image(image_path: str | Path, *, mock: bool = True) -> dict:
    """Observe the advertisement image.

    Args:
        image_path: absolute path to the stored upload.
        mock: when True, return the labelled placeholder instead of inferring.

    Returns a dict:
        {
          "engine": str, "is_mock": bool, "observations": [VisionObservation],
          "note": str
        }

    Raises:
        NotConfiguredError: when real inference is requested but unavailable.
    """
    if mock:
        return mock_observations()

    reason = not_configured_reason()
    if reason:
        raise NotConfiguredError(reason)

    from app.services import ollama_service

    path = Path(image_path)
    if not path.is_file():
        raise NotConfiguredError(f"Vision engine received a missing image path.")

    mime = mimetypes.guess_type(str(path))[0] or "image/png"
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
