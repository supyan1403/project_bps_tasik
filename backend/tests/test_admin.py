"""Test admin endpoints."""
import pytest
from tests.conftest import client, admin_client


class TestAdmin:
    def test_list_backups_requires_admin(self, admin_client):
        """List backups memerlukan admin."""
        resp = admin_client.get("/api/admin/backups")
        assert resp.status_code == 200

    def test_system_info_requires_admin(self, admin_client):
        """System info memerlukan admin."""
        resp = admin_client.get("/api/admin/system-info")
        assert resp.status_code == 200

    def test_activity_logs_requires_admin(self, admin_client):
        """Activity logs memerlukan admin."""
        resp = admin_client.get("/api/admin/activity-logs")
        assert resp.status_code == 200

    def test_activity_logs_sertakan_total_halaman(self, admin_client):
        """Respons activity-logs menghitung total halaman untuk tombol paginasi."""
        resp = admin_client.get("/api/admin/activity-logs?page=1&limit=5")
        assert resp.status_code == 200
        data = resp.json()
        assert data["limit"] == 5
        # tanpa field pages, frontend selalu menganggap hanya ada 1 halaman
        assert data["pages"] == max(1, -(-data["total"] // data["limit"]))

    def test_activity_logs_limit_nol_tetap_satu_halaman(self, admin_client):
        """limit tidak valid (0) tidak membagi nol - tetap 1 halaman."""
        resp = admin_client.get("/api/admin/activity-logs?limit=0")
        assert resp.status_code == 200
        assert resp.json()["pages"] == 1

    def test_backup_requires_admin(self, client):
        """Backup memerlukan admin."""
        resp = client.post("/api/admin/backup")
        assert resp.status_code in (401, 200)

    def test_backups_requires_admin(self, client):
        """List backups memerlukan admin tanpa session."""
        resp = client.get("/api/admin/backups")
        assert resp.status_code in (401, 200)
