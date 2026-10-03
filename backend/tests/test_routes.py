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


def test_root_admin_login_langsung_ke_app(admin_client):
    """Admin yang sudah login membuka / langsung diarahkan ke dashboard."""
    resp = admin_client.get("/")
    assert resp.history, "harus melewati redirect"
    assert resp.history[0].status_code == 302
    assert resp.url.path == "/app"


def test_root_sesi_tidak_valid_tetap_landing(client):
    """Cookie sipedas_session yang tidak terdaftar tidak mengalihkan ke /app."""
    client.cookies.set("sipedas_session", "bogus-session")
    resp = client.get("/")
    assert resp.status_code == 200
    assert not resp.history, "sesi tidak valid harus tetap di landing"
    assert "Cari &amp; Analisis Data" in resp.text


def test_root_cookie_landing_lama_diabaikan(client):
    """Cookie penanda versi lama maupun v2 tidak memicu redirect apa pun."""
    client.cookies.set("sipedas_landing_seen_v2", "1")
    client.cookies.set("sipedas_landing_seen", "1")
    resp = client.get("/")
    assert resp.status_code == 200
    assert not resp.history, "cookie penanda lama tidak boleh berpengaruh"
    assert "Cari &amp; Analisis Data" in resp.text


def test_root_tidak_menanam_cookie_penanda(client):
    """/ tidak lagi menanam cookie penanda apa pun."""
    resp = client.get("/")
    assert resp.headers.get_list("set-cookie") == []


def test_root_paksa_landing_walau_admin(admin_client):
    """Admin yang sudah login tetap bisa memaksa landing lewat /?landing=1."""
    resp = admin_client.get("/?landing=1")
    assert resp.status_code == 200
    assert not resp.history, "?landing=1 harus memaksa landing, bukan redirect"
    assert "Cari &amp; Analisis Data" in resp.text


def test_root_menampilkan_section_lengkap(client):
    """Landing kini memuat section Tentang, Analisis Deret Waktu, dan CTA akhir."""
    html = client.get("/").text
    assert 'id="tentang"' in html
    assert 'id="deret-waktu"' in html
    assert "Eksplorasi Deret Waktu" in html
    assert "Pilih Indikator Master" in html
    assert "Siap melihat tren data" in html


def test_root_chips_fokus_deret_waktu(client):
    """Chips hero hanya memuat kemampuan role pegawai, bukan halaman admin."""
    html = client.get("/").text
    assert "Tren Lintas Tahun" in html
    assert "Grafik Garis &amp; Batang" in html
    assert "Ekspor CSV &middot; Excel" in html
    assert "Publikasi Statistik" not in html
    assert "Data Tabel" not in html


def test_root_tidak_menyebut_pdf(client):
    """Konten landing tidak lagi menyebut PDF sama sekali."""
    html = client.get("/").text
    assert "PDF" not in html


def test_root_memuat_skrip_motif_menyambung(client):
    """Skrip yang memanjangkan motif sepanjang halaman ikut terkirim."""
    html = client.get("/").text
    assert ".glow-field.is-full" in html
    assert "ResizeObserver" in html
    assert "pathLength" in html
    assert "ln-f" in html


def test_root_tidak_menyebut_menu_admin(client):
    """Landing tidak boleh menjelaskan fitur yang hanya bisa dibuka admin."""
    html = client.get("/").text
    for frasa in (
        "Manajemen Database",
        "Ekstraksi PDF",
        "Import Excel",
        "Mode Pemeliharaan",
        "Anomali Header",
        "Backup Database",
    ):
        assert frasa not in html, frasa


def test_root_menulis_badan_pusat_statistik_penuh(client):
    """Singkatan BPS tidak lagi dipakai di halaman landing."""
    html = client.get("/").text
    assert "BPS" not in html
    assert "Badan Pusat Statistik Kabupaten Tasikmalaya" in html
    assert "bps3206@bps.go.id" in html


def test_root_menampilkan_alamat_dan_kontak(client):
    """Alamat resmi ikut tampil di footer lengkap."""
    html = client.get("/").text
    assert "Jalan Raya Timur km 4 Cintaraja Singaparna Tasikmalaya 46417" in html
    assert "(0265) 549281" in html
    assert "(0265) 549253" in html


def test_root_statistik_di_render_dari_database(client):
    """Baris ringkasan angka disusun dari database, bukan teks mati."""
    html = client.get("/").text
    assert "Rentang Tahun Data" in html
    assert "Publikasi Resmi" in html
    assert "Tabel Statistik" in html
    assert "Baris Data" in html
