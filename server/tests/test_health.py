"""Health endpoint tests — must stay healthy while Ollama is unavailable."""
from __future__ import annotations


def test_health_is_online(client):
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "online"
    assert body["service"] == "Inkloom AI"
    assert body["version"] == "1.0.0"
    assert body["database"] == "connected"
    # Not configured in the test environment -> honest, non-error state.
    assert body["ollama_status"] in ("not_configured", "offline", "ready", "model_missing")


def test_root_and_docs(client):
    assert client.get("/").status_code == 200
    assert client.get("/docs").status_code == 200
