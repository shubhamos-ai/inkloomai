"""NVIDIA NIM Vision API service — replaces local Ollama for production deployment.

Uses the NVIDIA API Catalog (NIM) for vision-language inference.
Supports deployment on Render.com and other cloud platforms.
"""
from __future__ import annotations

import base64
import json
import os
from typing import Optional

import httpx

from app.config import settings

# Status constants
STATUS_NOT_CONFIGURED = "not_configured"
STATUS_OFFLINE = "offline"
STATUS_READY = "ready"

# NVIDIA NIM API endpoints
NVIDIA_NIM_BASE = "https://api.nvcf.nvidia.com/v2/nim/llama-3.2-11b-vision-instruct"
NVIDIA_NIM_CHAT_COMPLETIONS = f"{NVIDIA_NIM_BASE}/chat/completions"


def get_nvidia_api_key() -> str:
    """Get NVIDIA API key from environment or settings."""
    return os.getenv("NVIDIA_API_KEY", settings.NVIDIA_API_KEY if hasattr(settings, 'NVIDIA_API_KEY') else "")


def is_configured() -> bool:
    """Check if NVIDIA NIM is properly configured."""
    return bool(get_nvidia_api_key())


def check_status() -> dict:
    """Check NVIDIA NIM availability."""
    api_key = get_nvidia_api_key()
    if not api_key:
        return {
            "status": STATUS_NOT_CONFIGURED,
            "available": False,
            "vision_model": "llama-3.2-11b-vision-instruct",
            "detail": "NVIDIA_API_KEY not configured. Set NVIDIA_API_KEY environment variable.",
        }

    try:
        with httpx.Client(timeout=10.0) as client:
            # Test with a simple health check to the NIM endpoint
            resp = client.get(
                "https://api.nvcf.nvidia.com/v2/nim/llama-3.2-11b-vision-instruct/info",
                headers={"Authorization": f"Bearer {api_key}"},
            )
            if resp.status_code == 200:
                return {
                    "status": STATUS_READY,
                    "available": True,
                    "vision_model": "llama-3.2-11b-vision-instruct",
                    "detail": "NVIDIA NIM Vision API is ready",
                }
            else:
                return {
                    "status": STATUS_OFFLINE,
                    "available": False,
                    "vision_model": "llama-3.2-11b-vision-instruct",
                    "detail": f"NVIDIA API returned status {resp.status_code}",
                }
    except Exception as exc:
        return {
            "status": STATUS_OFFLINE,
            "available": False,
            "vision_model": "llama-3.2-11b-vision-instruct",
            "detail": f"NVIDIA API unreachable: {str(exc)}",
        }


def encode_image(image_path: str) -> str:
    """Encode image to base64 for API upload."""
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def generate(
    *,
    prompt: str,
    system: Optional[str] = None,
    image_b64: Optional[str] = None,
    images: Optional[list[str]] = None,
    fmt: str = "json",
    stream: bool = False,
) -> str:
    """Generate response from NVIDIA NIM Vision API.

    Args:
        prompt: The user prompt
        system: System prompt (optional)
        image_b64: Base64 encoded image (optional)
        images: List of image paths to encode and send (optional)
        fmt: Response format (default: json)
        stream: Whether to stream the response (default: False)

    Returns:
        The generated text response as a string
    """
    api_key = get_nvidia_api_key()
    if not api_key:
        raise RuntimeError("NVIDIA_API_KEY not configured. Set NVIDIA_API_KEY environment variable.")

    # Handle images - encode if paths provided
    image_data = []
    if images:
        for img_path in images:
            if os.path.exists(img_path):
                image_data.append({
                    "type": "base64",
                    "data": encode_image(img_path),
                })
    elif image_b64:
        image_data.append({
            "type": "base64",
            "data": image_b64,
        })

    # Build messages for multimodal input
    messages = []

    if system:
        messages.append({"role": "system", "content": system})

    # Build content array for user message (text + images)
    content_parts = []
    if prompt:
        content_parts.append({"type": "text", "text": prompt})

    for img in image_data:
        content_parts.append({
            "type": "image_url",
            "image_url": {
                "url": f"data:image/jpeg;base64,{img['data']}",
            },
        })

    messages.append({"role": "user", "content": content_parts})

    payload = {
        "model": "llama-3.2-11b-vision-instruct",
        "messages": messages,
        "max_tokens": 2048,
        "temperature": 0.1,
        "top_p": 0.7,
    }

    if stream:
        payload["stream"] = True

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "NVCF-Use-Async-Op": "false",
    }

    with httpx.Client(timeout=120.0) as client:
        try:
            resp = client.post(
                NVIDIA_NIM_CHAT_COMPLETIONS,
                json=payload,
                headers=headers,
            )
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise RuntimeError(f"NVIDIA NIM API request failed: {exc}") from exc

        data = resp.json()

        # Extract the generated text
        if "choices" in data and len(data["choices"]) > 0:
            choice = data["choices"][0]
            if "message" in choice:
                return choice["message"].get("content", "")
            elif "delta" in choice:
                return choice["delta"].get("content", "")

        raise RuntimeError("Unexpected response format from NVIDIA NIM API")


def parse_json_loose(raw: str) -> dict | list:
    """Parse model output tolerantly: raw JSON, fenced JSON, or first object."""
    import re

    raw = (raw or "").strip()
    if not raw:
        raise ValueError("Empty model response")

    # Try unfenced JSON first
    try:
        return json.loads(raw)
    except Exception:
        pass

    # Try fenced JSON
    json_blocks = re.findall(r"```(?:json)?\s*(.+?)```", raw, re.S)
    for block in json_blocks:
        try:
            return json.loads(block)
        except Exception:
            continue

    # Try extracting first JSON object
    start = raw.find("{")
    end = raw.rfind("}") + 1
    if start >= 0 and end > start:
        try:
            return json.loads(raw[start:end])
        except Exception:
            pass

    raise ValueError("Model response is not valid JSON")