"""Test master data endpoints."""
import pytest
from tests.conftest import client, admin_client


class TestMasterColumns:
    def test_get_master_columns(self, client):
        """Get master columns."""
        resp = client.get("/api/master/columns")
        assert resp.status_code == 200

    def test_search_columns(self, client):
        """Search columns."""
        resp = client.get("/api/master/columns/search?q=nama")
        assert resp.status_code == 200

    def test_column_usage(self, client):
        """Get column usage stats."""
        resp = client.get("/api/master/columns/usage?column_name=nama")
        assert resp.status_code == 200
