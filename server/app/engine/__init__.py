"""AI engine package.

Each engine is an interface with two realisations:
- `_mock`  -> deterministic placeholder output, clearly labelled `is_mock`.
- `_ai`    -> real Ollama inference, enabled once the Vision SLM is available.

Engines never write to the database and never touch the filesystem.
"""
from app.engine.base import NotConfiguredError

__all__ = ["NotConfiguredError"]
