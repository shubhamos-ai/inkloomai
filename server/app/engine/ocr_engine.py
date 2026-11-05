"""OCR engine interface.

Real mode (planned): Tesseract or Ollama-based exact text extraction.
Mock mode: returns a labelled placeholder — it must never fabricate text that
was not actually extracted from the image.
"""
from __future__ import annotations

import shutil

from app.engine.base import NotConfiguredError


def is_configured() -> bool:
    return shutil.which("tesseract") is not None


def not_configured_reason() -> str | None:
    if shutil.which("tesseract") is None:
        return "tesseract binary not found — OCR engine not configured."
    return None


def mock_ocr() -> dict:
    return {
        "engine": "mock",
        "is_mock": True,
        "text": "",
        "note": "Placeholder OCR — no text extraction performed yet.",
    }


def extract_text(image_path: str, *, mock: bool = True) -> dict:
    """Extract the exact text visible in the advertisement.

    Returns {"engine", "is_mock", "text", "confidence", "note"}.
    """
    if mock:
        return mock_ocr()

    reason = not_configured_reason()
    if reason:
        raise NotConfiguredError(reason)

    import pytesseract  # type: ignore  # wired when OCR mode is enabled
    from PIL import Image

    img = Image.open(image_path)
    text = pytesseract.image_to_string(img).strip()
    return {"engine": "tesseract", "is_mock": False, "text": text, "note": ""}


def text_from_vision(vision: dict) -> str:
    """Fallback OCR: transcribed text lines from the vision engine's observations.

    Used when no dedicated OCR engine is installed. Since the observations come
    from real inference, this is real (if imperfect) extracted text with the
    proper provenance label ("vision_transcription").
    """
    lines = []
    for obs in vision.get("observations", []):
        if isinstance(obs, dict):
            attr = str(obs.get("attribute", ""))
            if "text" in attr.lower():
                value = str(obs.get("value", "")).strip()
                if value:
                    lines.append(value)
    return "\n".join(lines)
