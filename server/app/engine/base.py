"""Engine base types."""
from __future__ import annotations


class NotConfiguredError(Exception):
    """Raised when an engine is invoked but the AI backend it needs is absent.

    The job worker translates this into a failed analysis with a
    `configuration_error` code — it is a controlled condition, not a crash.
    """


class ProviderError(Exception):
    """Raised when a configured AI provider fails transiently.

    The worker retries these with exponential backoff instead of fabricating a
    report, so an outage is never reported as a completed analysis.
    """
