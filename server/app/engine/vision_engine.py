"""Vision engine interface.

Supports multiple vision providers:
- NVIDIA NIM (production - deployable on Render.com)
- Ollama (local development only)
- Mock (testing)

Real mode: sends the advertisement image to the configured vision provider
and returns structured visual observations. In mock mode it returns a
deterministic placeholder so the whole pipeline can be exercised end-to-end.
"""
from __future__ import annotations

import base64
import mimetypes
import os
from pathlib import Path

from app.config import settings
from app.engine.base import NotConfiguredError


def is_configured() -> bool:
    """Check if any vision provider is configured."""
    return settings.use_nvidia_nim or settings.use_ollama or settings.use_mock


def not_configured_reason() -> str | None:
    """Return reason why vision is not configured."""
    if settings.use_mock:
        return None  # Mock is always "configured"
    if not settings.use_nvidia_nim and not settings.use_ollama:
        return (
            "No vision provider configured. Set NVIDIA_API_KEY for production "
            "(Llama 3.2 11B Vision) or OLLAMA_VISION_MODEL for local development."
        )
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


def _get_vision_provider_info() -> tuple[str, bool]:
    """Return (provider_name, is_mock)."""
    if settings.use_mock:
        return ("mock", True)
    if settings.use_nvidia_nim:
        return ("nvidia_nim", False)
    if settings.use_ollama:
        return ("ollama", False)
    return ("mock", True)


def analyze_image(image_path: str | Path, *, mock: bool = None) -> dict:
    """Observe the advertisement image.

    Args:
        image_path: absolute path to the stored upload.
        mock: override for mock mode (None = use settings)

    Returns a dict:
        {
          "engine": str, "is_mock": bool, "observations": [VisionObservation],
          "note": str
        }

    Raises:
        NotConfiguredError: when real inference is requested but unavailable.
    """
    # Determine if we should use mock
    if mock is None:
        provider, is_mock = _get_vision_provider_info()
    else:
        is_mock = mock
        provider = "mock"

    if is_mock:
        return mock_observations()

    reason = not_configured_reason()
    if reason:
        raise NotConfiguredError(reason)

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

    # Use NVIDIA NIM if configured, otherwise Ollama
    if settings.use_nvidia_nim:
        from app.services import nim_vision_service

        raw = nim_vision_service.generate(prompt=prompt, image_b64=b64, images=[b64])
        parsed = nim_vision_service.parse_json_loose(raw)
        engine_name = "llama-3.2-11b-vision-instruct"
    else:
        from app.services import ollama_service

        raw = ollama_service.generate(prompt=prompt, image_b64=b64, images=[b64])
        parsed = ollama_service.parse_json_loose(raw)
        engine_name = settings.OLLAMA_VISION_MODEL

    return {
        "engine": engine_name,
        "is_mock": False,
        "observations": parsed.get("observations", []) if isinstance(parsed, dict) else [],
        "note": "",
    }