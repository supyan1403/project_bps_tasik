"""app.js adalah hasil build dari modul frontend/static/js/0*.js - wajib sinkron."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
JS_DIR = ROOT / "frontend" / "static" / "js"
APP_JS = ROOT / "frontend" / "static" / "app.js"


def test_app_js_sinkron_dengan_modul_js():
    """app.js harus identik dengan konkatenasi js/0*.js dalam urutan 01..08."""
    sources = sorted(JS_DIR.glob("0*.js"))
    assert sources, f"tidak ada modul 0*.js di {JS_DIR}"

    expected = b"".join(path.read_bytes() for path in sources)
    actual = APP_JS.read_bytes()

    assert actual == expected, (
        "frontend/static/app.js tidak sinkron dengan modul js/0*.js. "
        "Edit js/0*.js -> jalankan 'python build_app.py'; "
        "edit app.js -> jalankan 'python build_app.py --split'"
    )
