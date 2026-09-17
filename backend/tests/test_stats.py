"""Test stats endpoints."""
import pytest
from tests.conftest import client


class TestStats:
    def test_stats_overview(self, client):
        """Stats overview mengembalikan data KPI."""
        resp = client.get("/api/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert "total_tables" in data or "tabel" in str(data).lower()

    def test_stats_chart(self, client):
        """Stats chart mengembalikan data chart."""
        resp = client.get("/api/stats/chart")
        assert resp.status_code == 200
