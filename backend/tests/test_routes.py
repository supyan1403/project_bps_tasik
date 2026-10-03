"""Tes rute halaman: landing page di "/" dan dashboard di "/app"."""


def test_root_menyajikan_landing_page(client):
    """/ harus berisi landing page (hero + tombol akses), bukan dashboard."""
    resp = client.get("/")
    assert resp.status_code == 200
    assert "Cari &amp; Analisis Data" in resp.text
    assert "data-initial-sidebar-collapsed" not in resp.text
    assert "page-section" not in resp.text


def test_root_hanya_mempunyai_satu_pintu(client):
    """Landing hanya menautkan /app; /login sengaja tidak dipublikasikan."""
    html = client.get("/").text
    assert 'href="/app"' in html
    assert 'href="/login"' not in html
    assert "Login Admin" not in html


def test_root_tidak_diacache(client):
    """Landing page disajikan tanpa cache agar perubahan langsung terlihat."""
    resp = client.get("/")
    assert resp.headers["Cache-Control"].startswith("no-store")


def test_app_menyajikan_dashboard_tanpa_login(client):
    """/app tetap terbuka untuk pegawai tanpa sesi (tanpa login)."""
    resp = client.get("/app")
    assert resp.status_code == 200
    assert "data-initial-sidebar-collapsed" in resp.text
    assert "page-section" in resp.text
    assert "role-pegawai" in resp.text
    assert resp.headers["Cache-Control"].startswith("no-store")


def test_login_page_masih_tersedia(client):
    """Halaman login admin tetap ada di /login."""
    resp = client.get("/login")
    assert resp.status_code == 200
    assert "Login Administrator" in resp.text


def test_admin_login_di_lock_ke_app(admin_client):
    """Admin yang sudah login dan membuka /login langsung diarahkan ke /app."""
    resp = admin_client.get("/login")
    assert resp.history, "harus melewati redirect"
    assert resp.history[0].status_code == 303
    assert resp.url.path == "/app"
