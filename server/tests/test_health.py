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
    # Provider health is honest, non-error state regardless of configuration.
    # "configured" means the provider is set up but was intentionally not probed.
    assert body["vision_status"] in (
        "not_configured", "offline", "configured", "ready", "unknown", "ready_mock"
    )
    # The default health response is fast: no outbound provider probes.
    assert "providers" not in body


def test_health_deep_probe_is_opt_in(client, monkeypatch):
    """Deep provider diagnostics must only run when explicitly requested."""
    import app.api.v1.health as health_module
    import app.services.nim_vision_service as nim_service
    import app.services.ollama_service as ollama_service

    monkeypatch.setattr(
        health_module,
        "_configured_provider",
        lambda: ("nvidia_nim", "configured"),
    )
    monkeypatch.setattr(
        nim_service,
        "check_status",
        lambda: {"status": "ready", "available": True, "vision_model": "test-model"},
    )
    monkeypatch.setattr(
        ollama_service,
        "check_status",
        lambda: {"status": "not_configured", "available": False},
    )
    resp = client.get("/api/v1/health?deep=true")
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body.get("providers"), dict)
    for name in ("ollama", "nvidia_nim"):
        assert name in body["providers"]
        assert body["providers"][name]["status"] in (
            "not_configured", "offline", "ready", "model_missing"
        )


def test_root_and_docs(client):
    assert client.get("/").status_code == 200
    assert client.get("/docs").status_code == 200
