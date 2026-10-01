"""Test auth endpoints."""
from datetime import timedelta

import pytest
from models import LoginAttempt
from routers.auth import LOCKOUT_DURATION_SECONDS, _now
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


class TestLockoutPersistence:
    """Sifat rate limiter yang kini disimpan di database (bukan dict in-memory)."""

    def test_lockout_tersimpan_di_database(self, client, db):
        """5x gagal menghasilkan baris login_attempts dengan lock_until terisi."""
        for _ in range(5):
            client.post("/api/auth/login", json={"password": "wrong"})

        row = db.query(LoginAttempt).filter(LoginAttempt.failed_count >= 5).first()
        assert row is not None, "Percobaan gagal harus tercatat di tabel login_attempts"
        assert row.lock_until is not None

        resp = client.post("/api/auth/login", json={"password": "wrong"})
        assert resp.status_code == 429

    def test_hitungan_reset_setelah_diam_5_menit(self, client, db):
        """Setelah 5 menit tanpa kegagalan, hitungan direset -> kembali boleh coba."""
        for _ in range(5):
            client.post("/api/auth/login", json={"password": "wrong"})

        row = db.query(LoginAttempt).filter(LoginAttempt.failed_count >= 5).first()
        assert row is not None
        row.last_failed_at = _now() - timedelta(seconds=LOCKOUT_DURATION_SECONDS + 60)
        db.commit()

        resp = client.post("/api/auth/login", json={"password": "wrong"})
        assert resp.status_code == 401
        assert "4" in resp.json()["detail"]  # sisa percobaan kembali penuh-1

    def test_login_sukses_menghapus_catatan(self, client, db):
        """Login berhasil membersihkan baris percobaan milik IP tersebut."""
        for _ in range(3):
            client.post("/api/auth/login", json={"password": "wrong"})
        assert db.query(LoginAttempt).count() >= 1

        resp = client.post("/api/auth/login", json={"password": "test_password_123"})
        assert resp.status_code == 200
        assert db.query(LoginAttempt).count() == 0
