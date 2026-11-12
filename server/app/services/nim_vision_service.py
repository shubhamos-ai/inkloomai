"""NVIDIA NIM Vision API service — replaces local Ollama for production deployment.

Uses the NVIDIA API Catalog (NIM) for vision-language inference.
Supports deployment on Render.com and other cloud platforms.
"""
from __future__ import annotations

import base64
import io
import json
import os
from typing import Optional

import httpx

from app.config import settings

# Status constants
STATUS_NOT_CONFIGURED = "not_configured"
STATUS_OFFLINE = "offline"
STATUS_READY = "ready"

# NVIDIA NIM API endpoints (OpenAI-compatible catalog endpoint)
NVIDIA_NIM_BASE = "https://integrate.api.nvidia.com/v1"
NVIDIA_NIM_CHAT_COMPLETIONS = f"{NVIDIA_NIM_BASE}/chat/completions"

# Image resizing: NIM times out / errors on very large base64 payloads.
# Resize images so the longest edge is at most this many pixels before encoding.
MAX_IMAGE_DIMENSION = 1024  # px — large enough for text/logo detection
MAX_IMAGE_B64_BYTES = 1_500_000  # ~1.5MB b64 hard-cap (NIM recommends < 2MB)

DEFAULT_VISION_MODEL = "meta/llama-3.2-90b-vision-instruct"


def get_vision_model() -> str:
    """Configured NIM vision model tag (falls back to the live default)."""
    return os.getenv(
        "NVIDIA_VISION_MODEL",
        settings.NVIDIA_VISION_MODEL if hasattr(settings, "NVIDIA_VISION_MODEL") else "",
    ) or DEFAULT_VISION_MODEL


def get_nvidia_api_key() -> str:
    """Get NVIDIA API key from environment or settings."""
    return os.getenv("NVIDIA_API_KEY", settings.NVIDIA_API_KEY if hasattr(settings, 'NVIDIA_API_KEY') else "")


def is_configured() -> bool:
    """Check if NVIDIA NIM is properly configured."""
    return bool(get_nvidia_api_key())


def check_status() -> dict:
    """Check NVIDIA NIM availability (model listed in the live catalog)."""
    api_key = get_nvidia_api_key()
    model = get_vision_model()
    if not api_key:
        return {
            "status": STATUS_NOT_CONFIGURED,
            "available": False,
            "vision_model": model,
            "detail": "NVIDIA_API_KEY not configured. Set NVIDIA_API_KEY environment variable.",
        }

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(
                f"{NVIDIA_NIM_BASE}/models",
                headers={"Authorization": f"Bearer {api_key}"},
            )
            if resp.status_code == 200:
                listed = False
                try:
                    ids = [m.get("id") for m in resp.json().get("data", [])]
                    listed = model in ids
                except Exception:  # noqa: BLE001 — health must never raise
                    listed = False
                return {
                    "status": STATUS_READY if listed else STATUS_OFFLINE,
                    "available": listed,
                    "vision_model": model,
                    "detail": (
                        "NVIDIA NIM Vision API is ready"
                        if listed
                        else f"Configured model {model!r} is not served by the NVIDIA API catalog"
                    ),
                }
            else:
                return {
                    "status": STATUS_OFFLINE,
                    "available": False,
                    "vision_model": model,
                    "detail": f"NVIDIA API returned status {resp.status_code}",
                }
    except Exception as exc:
        return {
            "status": STATUS_OFFLINE,
            "available": False,
            "vision_model": model,
            "detail": f"NVIDIA API unreachable: {str(exc)}",
        }


def encode_image(image_path: str) -> str:
    """Encode image to base64 for API upload, resizing if necessary.

    NIM times out on very large image payloads.  Any image whose longest
    side exceeds MAX_IMAGE_DIMENSION is downscaled proportionally before
    encoding.  The result is re-encoded as JPEG (quality 85) to keep the
    payload well under the 2 MB soft-cap.
    """
    try:
        from PIL import Image  # type: ignore[import-untyped]

        with Image.open(image_path) as img:
            # Convert RGBA / palette → RGB so JPEG save works
            if img.mode in ("RGBA", "P", "LA"):
                bg = Image.new("RGB", img.size, (255, 255, 255))
                if img.mode == "P":
                    img = img.convert("RGBA")
                bg.paste(img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None)
                img = bg
            elif img.mode != "RGB":
                img = img.convert("RGB")

            # Resize if needed
            w, h = img.size
            longest = max(w, h)
            if longest > MAX_IMAGE_DIMENSION:
                scale = MAX_IMAGE_DIMENSION / longest
                img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

            # Encode to JPEG in memory
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=85, optimize=True)
            raw_bytes = buf.getvalue()

            # If still too big, re-encode at lower quality
            if len(raw_bytes) * 1.37 > MAX_IMAGE_B64_BYTES:  # rough b64 inflation
                buf = io.BytesIO()
                img.save(buf, format="JPEG", quality=60, optimize=True)
                raw_bytes = buf.getvalue()

            return base64.b64encode(raw_bytes).decode()

    except ImportError:
        # PIL not available — fall back to raw file encoding (may be large)
        with open(image_path, "rb") as f:
            return base64.b64encode(f.read()).decode()


def _resize_b64_if_needed(b64_str: str) -> str:
    """If a raw base64 image string is oversized for NIM, decode→resize→re-encode.

    NIM reliably times out on payloads > ~2 MB.  This helper is a no-op when
    PIL is unavailable or the image is already small enough.
    """
    if len(b64_str) <= MAX_IMAGE_B64_BYTES:
        return b64_str  # already within limits

    try:
        from PIL import Image  # type: ignore[import-untyped]

        raw = base64.b64decode(b64_str)
        with Image.open(io.BytesIO(raw)) as img:
            if img.mode not in ("RGB",):
                img = img.convert("RGB")
            w, h = img.size
            longest = max(w, h)
            if longest > MAX_IMAGE_DIMENSION:
                scale = MAX_IMAGE_DIMENSION / longest
                img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=85, optimize=True)
            return base64.b64encode(buf.getvalue()).decode()
    except Exception:  # noqa: BLE001
        # If anything fails, pass through original (NIM may still handle it)
        return b64_str


def generate(
    *,
    prompt: str,
    system: Optional[str] = None,
    image_b64: Optional[str] = None,
    images: Optional[list[str]] = None,
    fmt: str = "json",
    stream: bool = False,
    model: Optional[str] = None,
    max_tokens: Optional[int] = None,
    timeout: Optional[float] = None,
    extra_payload: Optional[dict] = None,
) -> str:
    """Generate response from NVIDIA NIM Vision API.

    Args:
        prompt: The user prompt
        system: System prompt (optional)
        image_b64: Base64 encoded image (optional)
        images: List of image paths to encode and send (optional)
        fmt: Response format (default: json)
        stream: Whether to stream the response (default: False)
        model: Specific model tag to use (optional)
        max_tokens: Maximum tokens in response (default: 4096 or custom)
        timeout: HTTP request timeout in seconds (default: settings.EXTRACTION_TIMEOUT_SECONDS or 90.0)
        extra_payload: Provider-specific fields merged into the request body
            (for example chat_template_kwargs to disable hidden reasoning).

    Returns:
        The generated text response as a string
    """
    api_key = get_nvidia_api_key()
    if not api_key:
        raise RuntimeError("NVIDIA_API_KEY not configured. Set NVIDIA_API_KEY environment variable.")

    # Handle images - encode if file paths provided, accept raw base64 directly
    image_data: list[str] = []
    if images:
        for img in images:
            if isinstance(img, str) and img and os.path.exists(img):
                # File path provided — encode it (with auto-resize)
                image_data.append(encode_image(img))
            elif isinstance(img, str) and img:
                # Already a base64 string — resize if oversized
                image_data.append(_resize_b64_if_needed(img))
    elif image_b64:
        image_data.append(_resize_b64_if_needed(image_b64))

    # Build messages for multimodal input
    messages = []

    if system:
        messages.append({"role": "system", "content": system})

    if prompt:
        messages.append({
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                *[
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{data}"},
                    }
                    for data in image_data
                ],
            ],
        })
    elif image_data:
        # Image-only message with a neutral instruction
        messages.append({
            "role": "user",
            "content": [
                {"type": "text", "text": "Describe this image."},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{image_data[0]}"},
                },
            ],
        })

    # Default to 4096 tokens so large documents & rule extractions do not get truncated
    effective_max_tokens = max_tokens if max_tokens is not None else 4096

    payload = {
        "model": model or get_vision_model(),
        "messages": messages,
        "max_tokens": effective_max_tokens,
        "temperature": 0.1,
        "top_p": 0.7,
    }

    if extra_payload:
        payload.update(extra_payload)

    if stream:
        payload["stream"] = True

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "NVCF-Use-Async-Op": "false",
    }

    # Respect configured extraction / API timeout
    effective_timeout = (
        timeout
        if timeout is not None
        else getattr(settings, "EXTRACTION_TIMEOUT_SECONDS", 120.0)
    )

    with httpx.Client(timeout=effective_timeout) as client:
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
            message = choice.get("message") or choice.get("delta") or {}
            content = message.get("content")
            if content is None:
                # Reasoning models put their scratchpad in reasoning_content
                # and can leave content empty when the token budget runs out.
                reasoning = message.get("reasoning_content") or ""
                finish = choice.get("finish_reason")
                raise RuntimeError(
                    "NVIDIA NIM returned no answer content"
                    + (f" (finish_reason={finish})" if finish else "")
                    + (f"; {len(reasoning)} chars were spent on hidden reasoning"
                       if reasoning else "")
                    + ". Disable thinking or raise EXTRACTION_MAX_TOKENS."
                )
            return content

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

    # Truncated output (hit the completion budget): keep every complete object.
    from app.services.json_utils import salvage_partial_json

    salvaged = salvage_partial_json(raw)
    if salvaged is not None:
        return salvaged

    raise ValueError("Model response is not valid JSON")