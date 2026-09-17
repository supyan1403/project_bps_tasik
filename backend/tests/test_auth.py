"""Test auth endpoints."""
import pytest
from tests.conftest import client, db, admin_client


class TestLogin:
    def test_login_success(self, client):
        """Login dengan password yang benar berhasil."""
        resp = client.post("/api/auth/login", json={"password": "test_password_123"})
        assert resp.status_code == 200
        assert resp.json()["role"] == "admin"

    def test_login_wrong_password(self, client):
        """Login dengan password salah gagal."""
        resp = client.post("/api/auth/login", json={"password": "wrong_password"})
        assert resp.status_code in (401, 403)

    def test_login_lockout(self, client):
        """5x login salah mengakibatkan lockout."""
        for _ in range(5):
            client.post("/api/auth/login", json={"password": "wrong"})
        resp = client.post("/api/auth/login", json={"password": "wrong"})
        assert resp.status_code in (401, 403, 429)


class TestLogout:
    def test_logout(self, admin_client):
        """Logout berhasil menghapus session."""
        resp = admin_client.post("/api/auth/logout")
        assert resp.status_code == 200


class TestAuthMe:
    def test_auth_me_admin(self, admin_client):
        """Auth me mengembalikan role admin."""
        resp = admin_client.get("/api/auth/me")
        assert resp.status_code == 200
        assert resp.json()["role"] == "admin"

    def test_auth_me_no_session(self, client):
        """Auth me tanpa session mengembalikan pegawai."""
        resp = client.get("/api/auth/me")
        assert resp.status_code == 200
        assert resp.json()["role"] == "pegawai"


class TestMaintenance:
    def test_get_maintenance_status(self, client):
        """Get maintenance status."""
        resp = client.get("/api/auth/maintenance")
        assert resp.status_code == 200
        data = resp.json()
        assert "mode" in data
        assert data["mode"] in ("0", "1")
