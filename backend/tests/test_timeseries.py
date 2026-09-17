"""Test timeseries endpoints."""
import pytest
from tests.conftest import client


class TestTimeSeries:
    def test_catalog(self, client):
        """Timeseries catalog mengembalikan list."""
        resp = client.get("/api/timeseries/catalog")
        assert resp.status_code == 200

    def test_indicator_years(self, client):
        """Indicator years mengembalikan data."""
        resp = client.get("/api/timeseries/indicator-years")
        assert resp.status_code == 200

    def test_data_by_indicators(self, client):
        """Data by indicators tanpa parameter."""
        resp = client.get("/api/timeseries/data-by-indicators")
        assert resp.status_code in (200, 422)

    def test_browse_data(self, client):
        """Browse data tanpa table_id."""
        resp = client.get("/api/timeseries/browse-data")
        assert resp.status_code in (200, 422)

    def test_legacy_search(self, client):
        """Legacy search."""
        resp = client.get("/api/search/timeseries?q=test")
        assert resp.status_code == 200

    def test_table_columns(self, client):
        """Get table columns."""
        resp = client.get("/api/timeseries/table-columns")
        assert resp.status_code in (200, 422)
