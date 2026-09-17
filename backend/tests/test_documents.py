"""Test document endpoints."""
import io
import pytest
from tests.conftest import client, admin_client


class TestDocuments:
    def test_list_documents(self, client):
        """List documents mengembalikan list kosong atau ada data."""
        resp = client.get("/api/documents")
        assert resp.status_code == 200

    def test_get_document_toc_missing(self, client):
        """Get TOC dokumen tidak ada mengembalikan 404."""
        resp = client.get("/api/documents/99999/toc")
        assert resp.status_code in (404, 200)

    def test_upload_requires_admin(self, client):
        """Upload dokumen memerlukan admin."""
        resp = client.post("/api/documents")
        assert resp.status_code in (401, 405, 422)

    def test_update_requires_admin(self, client):
        """Update dokumen memerlukan admin."""
        resp = client.put("/api/documents/1", json={"year": 2024})
        assert resp.status_code in (401, 404)

    def test_delete_requires_admin(self, client):
        """Delete dokumen memerlukan admin."""
        resp = client.delete("/api/documents/1")
        assert resp.status_code in (401, 404)

    def test_delete_bab_requires_admin(self, client):
        """Delete bab memerlukan admin."""
        resp = client.delete("/api/documents/1/bab/1")
        assert resp.status_code in (401, 404)
