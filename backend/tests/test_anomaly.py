"""Test anomaly endpoints."""
import pytest
from tests.conftest import client, admin_client


class TestAnomaly:
    def test_master_dictionary(self, client):
        """Get master dictionary."""
        resp = client.get("/api/master-dictionary")
        assert resp.status_code == 200

    def test_dismissed_anomalies(self, client):
        """Get dismissed anomalies."""
        resp = client.get("/api/dismissed-anomalies")
        assert resp.status_code == 200

    def test_timeseries_anomalies_requires_admin(self, admin_client):
        """Scan timeseries anomalies memerlukan admin."""
        resp = admin_client.get("/api/admin/timeseries-anomalies")
        assert resp.status_code == 200

    def test_all_anomalies_requires_admin(self, admin_client):
        """List all anomalies memerlukan admin."""
        resp = admin_client.get("/api/admin/anomalies")
        assert resp.status_code == 200

    def test_column_anomalies_requires_admin(self, admin_client):
        """List column anomalies memerlukan admin."""
        resp = admin_client.get("/api/admin/all-column-anomalies")
        assert resp.status_code == 200
