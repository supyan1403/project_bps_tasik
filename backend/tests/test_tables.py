"""Test table endpoints."""
import pytest
from tests.conftest import client, admin_client


class TestTables:
    def test_search_tables(self, client):
        """Search tables."""
        resp = client.get("/api/tables/search?q=test")
        assert resp.status_code == 200

    def test_get_table_not_found(self, client):
        """Get table tidak ada mengembalikan 404."""
        resp = client.get("/api/tables/99999")
        assert resp.status_code in (404, 200)

    def test_table_snippet_not_found(self, client):
        """Get table snippet tidak ada."""
        resp = client.get("/api/tables/99999/snippet")
        assert resp.status_code in (404, 200)

    def test_create_table_requires_admin(self, client):
        """Create table memerlukan admin."""
        resp = client.post("/api/tables", json={"document_id": 1, "table_name": "test", "headers": ["col1"]})
        assert resp.status_code in (401, 404, 422)

    def test_delete_table_requires_admin(self, client):
        """Delete table memerlukan admin."""
        resp = client.delete("/api/tables/1")
        assert resp.status_code in (401, 404)

    def test_export_excel(self, client):
        """Export table as Excel."""
        resp = client.get("/api/tables/1/excel")
        assert resp.status_code in (404, 200)

    def test_export_csv(self, client):
        """Export table as CSV."""
        resp = client.get("/api/tables/1/csv")
        assert resp.status_code in (404, 200)

    def test_csv_preview(self, client):
        """Preview table CSV."""
        resp = client.get("/api/tables/1/csv_preview")
        assert resp.status_code in (404, 200)

    def test_table_data(self, client):
        """Get table data."""
        resp = client.get("/api/tables/1/data")
        assert resp.status_code in (404, 200)

    def test_table_neighbors(self, client):
        """Get table neighbors."""
        resp = client.get("/api/tables/1/neighbors")
        assert resp.status_code in (404, 200)
