"""Rate limiting middleware.

A fixed-window counter per client IP, behind Cloudflare we trust
CF-Connecting-IP when present. State is in-process memory — sufficient for the
single-process development deployment; swap in Redis when running multiple
workers in production.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


@dataclass
class LimiterState:
    window_seconds: int = 60
    limit: int = 120
    _hits: dict[str, list[float]] = field(default_factory=dict)

    def hit(self, key: str) -> tuple[bool, int, int]:
        """Returns (allowed, remaining, retry_after_seconds)."""
        now = time.monotonic()
        cutoff = now - self.window_seconds
        bucket = [t for t in self._hits.get(key, []) if t > cutoff]
        if len(bucket) >= self.limit:
            retry_after = max(1, int(bucket[0] + self.window_seconds - now) + 1)
            self._hits[key] = bucket
            return False, 0, retry_after
        bucket.append(now)
        self._hits[key] = bucket
        # Occasional cleanup so the dict doesn't grow forever.
        if len(self._hits) > 10_000:
            stale = [k for k, ts in self._hits.items() if not ts or ts[-1] <= cutoff]
            for k in stale:
                self._hits.pop(k, None)
        return True, self.limit - len(bucket), 0


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, *, limit: int, window_seconds: int = 60, exempt_paths: tuple = ()):
        super().__init__(app)
        self.state = LimiterState(window_seconds=window_seconds, limit=limit)
        self.exempt_paths = exempt_paths

    @staticmethod
    def client_ip(request: Request) -> str:
        # Behind Cloudflare Tunnel, CF-Connecting-IP is the real client.
        cf_ip = request.headers.get("cf-connecting-ip")
        if cf_ip:
            return cf_ip
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if request.method == "OPTIONS" or any(path.startswith(p) for p in self.exempt_paths):
            return await call_next(request)

        ip = self.client_ip(request)
        allowed, remaining, retry_after = self.state.hit(f"ip:{ip}")
        if not allowed:
            return JSONResponse(
                status_code=429,
                headers={"Retry-After": str(retry_after), "X-RateLimit-Limit": str(self.state.limit)},
                content={"detail": {"error": "rate_limited", "message": "Too many requests. Please slow down."}},
            )
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(self.state.limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response
