"""Test _get_client_ip — IP rate-limit harus berasal dari header yang ditimpa proxy."""
from fastapi import Request

from routers.auth import _get_client_ip


def _make_request(headers: dict, client_host: str = "127.0.0.1") -> Request:
    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": "/api/auth/login",
        "raw_path": b"/api/auth/login",
        "query_string": b"",
        "root_path": "",
        "headers": [(k.lower().encode("ascii"), v.encode("utf-8")) for k, v in headers.items()],
        "client": (client_host, 54321),
        "server": ("testserver", 80),
    }
    return Request(scope, receive=lambda: None)


class TestGetClientIp:
    def test_x_real_ip_disahkan(self):
        """X-Real-IP (ditimpa nginx) menang atas X-Forwarded-For yang bisa dipalsukan."""
        req = _make_request({
            "X-Real-IP": "203.0.113.7",
            "X-Forwarded-For": "10.0.0.99, 203.0.113.7",
        })
        assert _get_client_ip(req) == "203.0.113.7"

    def test_xff_diambil_hop_terakhir(self):
        """Tanpa X-Real-IP, ambil hop TERAKHIR XFF (ditambah proxy), bukan yang dikirim klien."""
        req = _make_request({"X-Forwarded-For": "10.0.0.99, 198.51.100.20"})
        assert _get_client_ip(req) == "198.51.100.20"

    def test_xff_klien_tunggal(self):
        """XFF berisi satu hop tetap dipakai (tidak ada daftar kosong)."""
        req = _make_request({"X-Forwarded-For": "10.0.0.5"})
        assert _get_client_ip(req) == "10.0.0.5"

    def test_tanpa_header_pakai_client_host(self):
        """Tanpa header proxy sama sekali, pakai alamat koneksi langsung."""
        req = _make_request({}, client_host="192.0.2.10")
        assert _get_client_ip(req) == "192.0.2.10"

    def test_header_kosong_diabaikan(self):
        """Header yang ada tapi kosong/spasi tidak menutupi fallback."""
        req = _make_request({"X-Real-IP": "", "X-Forwarded-For": "   "}, client_host="192.0.2.11")
        assert _get_client_ip(req) == "192.0.2.11"
