"""Security utilities: company API keys, user passwords, session tokens."""
from __future__ import annotations

import hashlib
import re
import secrets
import unicodedata

# Company API keys: prefix makes leaked keys identifiable in log scanners;
# 32 url-safe bytes keeps brute force out of reach.
KEY_PREFIX = "ik_dev_"

# User passwords: PBKDF2-HMAC-SHA256 with high iteration count (OWASP-aligned).
PBKDF2_ITERATIONS = 390_000


def generate_api_key() -> str:
    return KEY_PREFIX + secrets.token_urlsafe(32)


def hash_api_key(key: str) -> str:
    """SHA-256 hex digest. Keys are high entropy random values, so a fast hash
    is acceptable. User passwords (below) use PBKDF2 instead."""
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def generate_session_token() -> str:
    """Opaque session token for browser sessions (204 bits of entropy)."""
    return secrets.token_urlsafe(32)


_SESSION_PREFIX = "il_sess_"


def session_token_prefix() -> str:
    return _SESSION_PREFIX


def new_session_token() -> str:
    return _SESSION_PREFIX + secrets.token_urlsafe(32)


def hash_password(password: str) -> str:
    """Format: pbkdf2_sha256$<iterations>$<salt_hex>$<hash_hex>."""
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS
    )
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, iterations, salt_hex, hash_hex = stored.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            bytes.fromhex(salt_hex),
            int(iterations),
        )
        return secrets.compare_digest(digest.hex(), hash_hex)
    except (ValueError, AttributeError):
        return False


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
