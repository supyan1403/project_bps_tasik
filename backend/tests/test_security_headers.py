"""Tes security header dan penonaktifan dokumentasi API di produksi."""
import os
import subprocess
import sys
import tempfile

_BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def test_security_headers_present(client):
    """Setiap respons membawa header hardening dasar."""
    resp = client.get("/api/auth/me")
    assert resp.status_code == 200
    assert resp.headers["X-Content-Type-Options"] == "nosniff"
    assert resp.headers["X-Frame-Options"] == "SAMEORIGIN"
    assert resp.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"


def test_hsts_absent_in_development(client):
    """HSTS tidak dikirim saat SIPEDAS_DOMAIN kosong (lokal)."""
    resp = client.get("/api/auth/me")
    assert "Strict-Transport-Security" not in resp.headers


def test_docs_enabled_in_development(client):
    """Mode pengembangan tetap membuka /docs dan /openapi.json."""
    assert client.get("/docs").status_code == 200
    assert client.get("/openapi.json").status_code == 200


def _isolated(config_lines):
    """Jalankan main.py di proses terpisah dengan SIPEDAS_DOMAIN terisi."""
    script = "\n".join(
        [
            "import sys",
            f"sys.path.insert(0, {_BACKEND_DIR!r})",
            "from fastapi.testclient import TestClient",
            "from main import app",
            "client = TestClient(app)",
            "me = client.get('/api/auth/me')",
            "docs = client.get('/docs')",
            "schema = client.get('/openapi.json')",
            *config_lines,
        ]
    )
    with tempfile.TemporaryDirectory() as tmp:
        env = dict(os.environ)
        env["DATABASE_URL"] = "sqlite:///" + os.path.join(tmp, "isolated.db")
        env["SIPEDAS_DOMAIN"] = "sipedas.example.test"
        proc = subprocess.run(
            [sys.executable, "-c", script],
            capture_output=True,
            text=True,
            timeout=120,
            env=env,
            cwd=_BACKEND_DIR,
            check=False,
        )
    assert proc.returncode == 0, f"{proc.stdout}\n{proc.stderr}"
    return proc.stdout.strip().splitlines()[-1]


def test_production_disables_docs_and_enables_hsts():
    """SIPEDAS_DOMAIN terisi -> skema API disembunyikan, HSTS aktif."""
    last_line = _isolated(
        [
            (
                "print(app.docs_url, app.redoc_url, app.openapi_url, "
                "me.status_code, docs.status_code, schema.status_code, "
                "repr(me.headers.get('Strict-Transport-Security')))"
            )
        ]
    )
    assert last_line == (
        "None None None 200 404 404 "
        "'max-age=31536000; includeSubDomains'"
    )
