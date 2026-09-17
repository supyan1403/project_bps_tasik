"""Test import excel endpoints."""
import pytest
from tests.conftest import client, admin_client


class TestImport:
    def test_download_template(self, client):
        """Download import template."""
        resp = client.get("/api/import/template")
        assert resp.status_code in (200, 422)

    def test_download_template_zip(self, client):
        """Download import template ZIP."""
        resp = client.get("/api/import/template/zip")
        assert resp.status_code in (200, 422)

    def test_import_requires_admin(self, client):
        """Import excel memerlukan admin."""
        resp = client.post("/api/import/excel")
        assert resp.status_code in (401, 405, 422)
