"""Security utilities: company API keys, hashing, file token safety."""
from __future__ import annotations

import hashlib
import re
import secrets
import unicodedata

# Company API keys: prefix makes leaked keys identifiable in log scanners;
# 32 url-safe bytes keeps brute force out of reach.
KEY_PREFIX = "ik_dev_"


def generate_api_key() -> str:
    return KEY_PREFIX + secrets.token_urlsafe(32)


def hash_api_key(key: str) -> str:
    """SHA-256 hex digest. Keys are high entropy random values, so a fast hash
    is acceptable until we move to user-account sessions in production."""
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def key_prefix_of(key: str, chars: int = 10) -> str:
    return key[:chars]


_UNSAFE_FS_CHARS = re.compile(r"[^A-Za-z0-9._-]+")
_MAX_NAME_LEN = 120


def sanitize_filename(name: str, fallback: str = "file") -> str:
    """Sanitize a client-supplied filename for display/storage metadata.

    The actual stored filenames are server-generated; this only makes the
    original name safe to persist for display."""
    if not name:
        return fallback
    name = unicodedata.normalize("NFKD", name)
    name = name.replace("\\", "/").rsplit("/", 1)[-1]  # keep basename only
    name = _UNSAFE_FS_CHARS.sub("_", name).strip("._")
    name = name[:_MAX_NAME_LEN]
    return name or fallback


def safe_relative_path(*parts: str) -> str:
    """Join path parts under the storage root, rejecting traversal attempts.

    Returns a '/'-separated relative path. Raises ValueError on unsafe input."""
    cleaned = []
    for part in parts:
        if not part or part in (".", ".."):
            raise ValueError(f"Unsafe path component: {part!r}")
        segment = _UNSAFE_FS_CHARS.sub("_", str(part))
        if segment.startswith("."):
            raise ValueError(f"Unsafe path component: {part!r}")
        cleaned.append(segment)
    return "/".join(cleaned)
