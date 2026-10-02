#!/usr/bin/env python3
"""Sinkronkan frontend/static/app.js dengan modul di frontend/static/js/.

index.html hanya memuat app.js, sedangkan repo juga menyimpan app.js yang
dipecah menjadi modul js/0*.js agar mudah dibaca. app.js adalah sumber
kebenaran (berkas yang benar-benar disajikan), js/ adalah turunannya.
Keduanya harus selalu identik byte-per-byte:

    app.js === js/01_core.js ++ ... ++ js/08_admin_system.js

Pemakaian:
    python build_app.py           regenerasi modul js/ dari app.js (bawaan)
    python build_app.py --build   bangun app.js dari modul js/
    python build_app.py --check   bandingkan saja, exit 1 bila tidak sinkron
"""
import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
JS_DIR = ROOT / "frontend" / "static" / "js"
OUT_FILE = ROOT / "frontend" / "static" / "app.js"

MODULES = [
    ("01_core.js", 1),
    ("02_navigation.js", 1575),
    ("03_import_excel.js", 3969),
    ("04_tables_editor.js", 5496),
    ("05_timeseries_wizard.js", 8686),
    ("06_timeseries_charts.js", 12148),
    ("07_master_anomalies.js", 16132),
    ("08_admin_system.js", 17324),
]


def source_files() -> list:
    """Modul js/0*.js dalam urutan konkatenasi (01..08)."""
    return sorted(JS_DIR.glob("0*.js"))


def build_payload() -> bytes:
    """Gabung semua modul sebagai byte mentah.

    Mode binary (bukan teks) dipakai agar line ending CRLF tiap modul
    terjaga persis - mode teks di Windows akan mengubah \\n menjadi \\r\\n.
    """
    return b"".join(path.read_bytes() for path in source_files())


def _line_starts(data: bytes) -> list:
    """Offset byte awal tiap baris (indeks 0 = baris ke-1)."""
    starts = [0]
    idx = data.find(b"\n")
    while idx != -1:
        starts.append(idx + 1)
        idx = data.find(b"\n", idx + 1)
    return starts


def split_payload(data: bytes) -> dict:
    """Pecah app.js menjadi potongan kontigu sesuai tabel MODULES."""
    starts = _line_starts(data)
    need = MODULES[-1][1]
    if len(starts) < need:
        raise ValueError(f"app.js hanya punya {len(starts)} baris, butuh minimal {need}")

    chunks = {}
    for pos, (name, start_line) in enumerate(MODULES):
        start = starts[start_line - 1]
        end = starts[MODULES[pos + 1][1] - 1] if pos + 1 < len(MODULES) else len(data)
        chunks[name] = data[start:end]
    return chunks


def do_split() -> int:
    if not OUT_FILE.exists():
        print(f"GAGAL: {OUT_FILE} tidak ada", file=sys.stderr)
        return 1

    data = OUT_FILE.read_bytes()
    try:
        chunks = split_payload(data)
    except ValueError as exc:
        print(f"GAGAL: {exc}", file=sys.stderr)
        return 1

    JS_DIR.mkdir(parents=True, exist_ok=True)
    for name, payload in chunks.items():
        (JS_DIR / name).write_bytes(payload)

    stale = [p for p in source_files() if p.name not in chunks]
    for path in stale:
        path.unlink()

    joined = b"".join(chunks[name] for name, _ in MODULES)
    if joined != data:
        print("GAGAL: hasil split tidak merekonstruksi app.js", file=sys.stderr)
        return 1

    print(f"[OK] {len(chunks)} modul js/ diregenerasi dari app.js ({len(data)} byte)")
    print("     " + ", ".join(name for name, _ in MODULES))
    if stale:
        print("     dihapus: " + ", ".join(p.name for p in stale))
    return 0


def do_check(sources: list, payload: bytes, current) -> int:
    if current == payload:
        print(f"[OK] app.js sinkron dengan {len(sources)} modul ({len(payload)} byte)")
        return 0
    print(
        f"[BEDA] app.js tidak sinkron dengan {len(sources)} modul js/0*.js.",
        file=sys.stderr,
    )
    print(
        "       Edit app.js        -> jalankan: python build_app.py",
        file=sys.stderr,
    )
    print(
        "       Edit js/0*.js      -> jalankan: python build_app.py --build",
        file=sys.stderr,
    )
    return 1


def do_build(payload: bytes) -> int:
    current = OUT_FILE.read_bytes() if OUT_FILE.exists() else None
    if current == payload:
        print(f"[OK] app.js sudah sinkron ({len(payload)} byte) - tidak diubah")
        return 0
    OUT_FILE.write_bytes(payload)
    if current is None:
        print(f"[OK] app.js dibuat dari modul ({len(payload)} byte)")
    else:
        print(f"[OK] app.js dibangun ulang: {len(current)} -> {len(payload)} byte")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Sinkronkan app.js dengan modul js/0*.js",
        epilog="Bawaan: regenerasi modul js/ dari app.js (app.js = sumber kebenaran).",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="hanya cek sinkronisasi, jangan tulis berkas",
    )
    parser.add_argument(
        "--build",
        action="store_true",
        help="bangun app.js dari modul js/ (arah kebalikan dari bawaan)",
    )
    parser.add_argument(
        "--split",
        action="store_true",
        help="regenerasi modul js/ dari app.js (sama dengan bawaan)",
    )
    args = parser.parse_args()

    if args.check:
        sources = source_files()
        if not sources:
            print(f"GAGAL: tidak ada modul 0*.js di {JS_DIR}", file=sys.stderr)
            return 1
        return do_check(sources, build_payload(), OUT_FILE.read_bytes() if OUT_FILE.exists() else None)

    if args.build:
        sources = source_files()
        if not sources:
            print(f"GAGAL: tidak ada modul 0*.js di {JS_DIR}", file=sys.stderr)
            return 1
        return do_build(build_payload())

    return do_split()


if __name__ == "__main__":
    sys.exit(main())
