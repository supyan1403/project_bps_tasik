"""Fixtures untuk testing SIPEDAS backend."""
import os
import sys

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Force SQLite for testing before importing database module
os.environ["DATABASE_URL"] = "sqlite:///test_sipedas.db"
os.environ.setdefault("SIPEDAS_ADMIN_PASSWORD", "test_password_123")

from database import Base, engine, SessionLocal
from main import app

# Remove stale auth_credentials.json so env var password is used
_AUTH_CREDS = os.path.join(os.path.dirname(__file__), "..", "data", "auth_credentials.json")
if os.path.exists(_AUTH_CREDS):
    try:
        os.remove(_AUTH_CREDS)
    except OSError:
        pass


@pytest.fixture(autouse=True)
def setup_db():
    """Buat tabel fresh sebelum setiap test, reset lockout state."""
    from routers.auth import _login_attempts
    _login_attempts.clear()
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    """FastAPI TestClient."""
    return TestClient(app)


@pytest.fixture
def db():
    """Database session untuk test langsung."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def admin_token(client):
    """Login sebagai admin dan return session cookie value."""
    resp = client.post("/api/auth/login", json={"password": "test_password_123"})
    if resp.status_code == 200:
        return client.cookies.get("sipedas_session")
    return None


@pytest.fixture
def admin_client(client, admin_token):
    """Client yang sudah login sebagai admin."""
    if admin_token:
        client.cookies.set("sipedas_session", admin_token)
    return client
