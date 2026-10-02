"""Test auth endpoints."""
from datetime import timedelta

import pytest
from models import LoginAttempt
from routers.auth import LOCKOUT_DURATION_SECONDS, _now
from tests.conftest import client, db, admin_client


class TestLogin:
    def test_login_success(self, client):
        """Login dengan password yang benar berhasil."""
        resp = client.post("/api/auth/login", json={"username": "admin", "password": "test_password_123"})
        assert resp.status_code == 200
        assert resp.json()["role"] == "admin"

    def test_login_wrong_password(self, client):
        """Login dengan password salah gagal."""
        resp = client.post("/api/auth/login", json={"username": "admin", "password": "wrong_password"})
        assert resp.status_code in (401, 403)

    def test_login_lockout(self, client):
        """5x login salah mengakibatkan lockout."""
        for _ in range(5):
            client.post("/api/auth/login", json={"username": "admin", "password": "wrong"})
        resp = client.post("/api/auth/login", json={"username": "admin", "password": "wrong"})
        assert resp.status_code in (401, 403, 429)

    def test_login_wrong_username(self, client):
        """Username yang tidak dikenal ditolak meski password benar."""
        resp = client.post("/api/auth/login", json={"username": "bukan_admin", "password": "test_password_123"})
        assert resp.status_code == 401

    def test_login_missing_username(self, client):
        """Permintaan tanpa field username ditolak."""
        resp = client.post("/api/auth/login", json={"password": "test_password_123"})
        assert resp.status_code == 401

    def test_pesan_401_tidak_membocorkan_field(self, client):
        """Pesan 'username salah' identik dengan 'password salah' (anti user-enumeration)."""
        salah_username = client.post(
            "/api/auth/login", json={"username": "bukan_admin", "password": "test_password_123"}
        )
        salah_password = client.post(
            "/api/auth/login", json={"username": "admin", "password": "wrong_password"}
        )
        assert salah_username.status_code == 401
        assert salah_password.status_code == 401

        # Hanya angka sisa percobaan yang boleh berbeda (kedua request memakai
        # counter yang sama); redaksi wajib identik dan menyebut kedua field
        # sehingga tidak membocorkan field mana yang salah.
        redaksi_username = salah_username.json()["detail"].split("Sisa percobaan")[0]
        redaksi_password = salah_password.json()["detail"].split("Sisa percobaan")[0]
        assert redaksi_username == redaksi_password
        assert redaksi_username == "Username atau password salah! "

    def test_lockout_terpicu_oleh_username_salah(self, client):
        """5x username salah tetap mengunci akses seperti password salah."""
        for _ in range(5):
            client.post("/api/auth/login", json={"username": "bukan_admin", "password": "x"})
        resp = client.post("/api/auth/login", json={"username": "bukan_admin", "password": "x"})
        assert resp.status_code == 429


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
            client.post("/api/auth/login", json={"username": "admin", "password": "wrong"})

        row = db.query(LoginAttempt).filter(LoginAttempt.failed_count >= 5).first()
        assert row is not None, "Percobaan gagal harus tercatat di tabel login_attempts"
        assert row.lock_until is not None

        resp = client.post("/api/auth/login", json={"username": "admin", "password": "wrong"})
        assert resp.status_code == 429

    def test_hitungan_reset_setelah_diam_5_menit(self, client, db):
        """Setelah 5 menit tanpa kegagalan, hitungan direset -> kembali boleh coba."""
        for _ in range(5):
            client.post("/api/auth/login", json={"username": "admin", "password": "wrong"})

        row = db.query(LoginAttempt).filter(LoginAttempt.failed_count >= 5).first()
        assert row is not None
        row.last_failed_at = _now() - timedelta(seconds=LOCKOUT_DURATION_SECONDS + 60)
        db.commit()

        resp = client.post("/api/auth/login", json={"username": "admin", "password": "wrong"})
        assert resp.status_code == 401
        assert "4" in resp.json()["detail"]  # sisa percobaan kembali penuh-1

    def test_login_sukses_menghapus_catatan(self, client, db):
        """Login berhasil membersihkan baris percobaan milik IP tersebut."""
        for _ in range(3):
            client.post("/api/auth/login", json={"username": "admin", "password": "wrong"})
        assert db.query(LoginAttempt).count() >= 1

        resp = client.post("/api/auth/login", json={"username": "admin", "password": "test_password_123"})
        assert resp.status_code == 200
        assert db.query(LoginAttempt).count() == 0


class TestChangePassword:
    def test_ganti_password_mempertahankan_username(self, admin_client):
        """Ganti password tidak menghapus kunci `username`, sehingga login tidak terkunci."""
        from routers.auth import _get_or_create_admin_credentials, _update_admin_password

        try:
            resp = admin_client.post(
                "/api/auth/change-password",
                json={"old_password": "test_password_123", "new_password": "new_password_456"},
            )
            assert resp.status_code == 200

            username, _, _ = _get_or_create_admin_credentials()
            assert username == "admin", "Username harus tetap tersimpan setelah ganti password"

            login = admin_client.post(
                "/api/auth/login",
                json={"username": "admin", "password": "new_password_456"},
            )
            assert login.status_code == 200, "Login ulang dengan password baru harus berhasil"
        finally:
            # Kembalikan password uji agar test lain tidak terdampak
            _update_admin_password("test_password_123")
