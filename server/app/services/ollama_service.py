"""Ollama service — the ONLY place that talks to the local inference server.

Ollama runs on 127.0.0.1 and is never exposed to the internet; requests here
either come from the worker (analysis pipeline) or from internal diagnostics.
"""
from __future__ import annotations

import json
import re
from typing import Optional

import httpx

from app.config import settings

STATUS_NOT_CONFIGURED = "not_configured"
STATUS_OFFLINE = "offline"
STATUS_MODEL_MISSING = "model_missing"
STATUS_READY = "ready"


def _client() -> httpx.Client:
    return httpx.Client(
        base_url=settings.OLLAMA_BASE_URL, timeout=settings.OLLAMA_TIMEOUT_SECONDS
    )


def check_status() -> dict:
    """Cheap readiness probe used by the health endpoint. Never raises."""
    if not settings.OLLAMA_VISION_MODEL:
        return {
            "status": STATUS_NOT_CONFIGURED,
            "available": False,
            "vision_model": None,
            "detail": "OLLAMA_VISION_MODEL is not configured yet.",
        }

    vision_model = settings.OLLAMA_VISION_MODEL
    try:
        resp = _client().get("/api/tags", timeout=3.0)
        resp.raise_for_status()
        tags = [m.get("name", "") for m in resp.json().get("models", [])]
    except Exception:
        return {
            "status": STATUS_OFFLINE,
            "available": False,
            "vision_model": vision_model,
            "detail": "Ollama server is unreachable.",
        }

    model_tags = {t.split(":")[0]: t for t in tags}
    base = vision_model.split(":")[0]
    matched = vision_model if vision_model in tags else model_tags.get(base)
    if not matched:
        return {
            "status": STATUS_MODEL_MISSING,
            "available": False,
            "vision_model": vision_model,
            "detail": f"Model '{vision_model}' is not pulled in Ollama yet.",
        }
    return {
        "status": STATUS_READY,
        "available": True,
        "vision_model": matched,
        "detail": "",
    }


def generate(
    *, prompt: str, system: Optional[str] = None, image_b64: Optional[str] = None,
    images: Optional[list[str]] = None, fmt: str = "json", stream: bool = False,
    model: Optional[str] = None,
) -> str:
    """Send a generation request. Raises RuntimeError on any failure so callers
    can degrade to mock-labeled behaviour."""
    if not settings.OLLAMA_VISION_MODEL:
        raise RuntimeError("Ollama vision model is not configured.")

    payload: dict = {
        "model": model or settings.OLLAMA_VISION_MODEL,
        "prompt": prompt,
        "stream": stream,
    }
    if system:
        payload["system"] = system
    if images:
        payload["images"] = images
    if image_b64 and "images" not in payload:
        payload["images"] = [image_b64]
    if fmt:
        payload["format"] = fmt

    with _client() as client:
        try:
            resp = client.post("/api/generate", json=payload)
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise RuntimeError(f"Ollama request failed: {exc}") from exc
        data = resp.json()
        return data.get("response", "")


_JSON_BLOCK = re.compile(r"```(?:json)?\s*(.+?)```", re.S)


def parse_json_loose(raw: str) -> dict | list:
    """Parse model output tolerantly: raw JSON, fenced JSON, or first object."""
    raw = (raw or "").strip()
    if not raw:
        raise ValueError("Empty model response")
    for attempt in (raw, *_JSON_BLOCK.findall(raw), raw[raw.find("{"): raw.rfind("}") + 1]):
        if not attempt:
            continue
        try:
            return json.loads(attempt)
        except Exception:
            continue

    from app.services.json_utils import salvage_partial_json

    salvaged = salvage_partial_json(raw)
    if salvaged is not None:
        return salvaged

    raise ValueError("Model response is not valid JSON")
