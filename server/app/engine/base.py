"""Engine base types."""
from __future__ import annotations


class NotConfiguredError(Exception):
    """Raised when an engine is invoked but the AI backend it needs is absent.

    The job worker translates this into a mock-labelled or failed analysis —
    it is a controlled condition, not a crash.
    """
