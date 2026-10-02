"""Tes endpoint health check untuk deploy & monitoring."""


def test_health_returns_ok_without_auth(client):
    """Health check terbuka tanpa login dan tidak menyentuh database."""
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_health_carries_security_headers(client):
    """Respons health check juga membawa security header."""
    resp = client.get("/health")
    assert resp.headers["X-Content-Type-Options"] == "nosniff"
