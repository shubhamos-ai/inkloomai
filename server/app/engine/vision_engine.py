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
import os
from pathlib import Path

from app.config import settings
from app.engine.base import NotConfiguredError, ProviderError


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

    # Auto-resize image for NIM to prevent HTTP read timeouts on large images
    if settings.use_nvidia_nim:
        from app.services import nim_vision_service
        b64 = nim_vision_service.encode_image(str(path))
    else:
        with open(path, "rb") as fh:
            b64 = base64.b64encode(fh.read()).decode("ascii")

    system_prompt = (
        "You are the Inkloom Vision Engine, an expert multimodal brand-governance system. "
        "Analyze the advertisement image with forensic precision. Extract neutral visual facts: "
        "1. Every visible text block verbatim (headlines, body copy, disclaimers, asterisks, footnotes, fine print). "
        "2. Exact pricing, discount percentages, promo codes, savings claims, and offer terms. "
        "3. Specific product details: product name, variant, flavor, scent, color, size, volume, net weight, ingredients. "
        "4. Branding: logos, brand names, taglines, emblems, badges, official certification marks. "
        "5. Visual styling: dominant brand colors, background palette, typography hierarchy, imagery subjects. "
        "6. Contact/mandatory info: URL, social handles, phone numbers, addresses, license or registration numbers. "
        "Return valid JSON matching: "
        '{"observations": [{"subject": str, "attribute": str, "value": str, "confidence": 0.0-1.0}]}'
    )
    prompt = (
        "Examine this advertisement image thoroughly. Record detailed visual observations. "
        "Carefully transcribe all text verbatim, noting specifically any discounts, prices, "
        "flavors, product variants, slogans, logos, and disclaimer footnotes. "
        "Do not evaluate compliance yet; report strictly factual visual evidence in JSON: "
        '{"observations": [{"subject": str, "attribute": str, "value": str, "confidence": 0.0-1.0}]}'
    )

    # Use the Inkloom Vision backend (NVIDIA NIM in production) if configured,
    # otherwise Ollama. A provider outage is surfaced as a retryable error so
    # the worker retries instead of fabricating observations.
    try:
        if settings.use_nvidia_nim:
            from app.services import nim_vision_service

            raw = nim_vision_service.generate(prompt=prompt, system=system_prompt, image_b64=b64)
            parsed = nim_vision_service.parse_json_loose(raw)
            engine_name = nim_vision_service.get_vision_model()
        else:
            from app.services import ollama_service

            raw = ollama_service.generate(prompt=prompt, system=system_prompt, image_b64=b64, images=[b64])
            parsed = ollama_service.parse_json_loose(raw)
            engine_name = settings.OLLAMA_VISION_MODEL
    except Exception as exc:  # noqa: BLE001 — provider outage is retryable
        raise ProviderError(
            f"Vision provider request failed ({type(exc).__name__})."
        ) from exc

    return {
        "engine": engine_name,
        "is_mock": False,
        "observations": parsed.get("observations", []) if isinstance(parsed, dict) else [],
        "image_b64": b64,
        "note": "",
    }