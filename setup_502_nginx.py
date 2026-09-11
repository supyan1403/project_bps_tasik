#!/usr/bin/env python3
"""
 SETUP OTOMATIS CUSTOM 502 NGINX SIPEDAS
 - Copy 502.html ke path nginx static root
 - Inject error_page directive ke nginx config
 - Reload nginx
"""
import os
import glob
import shutil
import subprocess
import sys

# === KONFIGURASI ===
# Path static root di server (sesuaikan jika berbeda)
STATIC_ROOTS = [
    "/var/www/sipedas/backend/static",
    "/var/www/sipedas/static",
]
NGINX_CONF_DIR = "/etc/nginx"

def find_nginx_conf():
    """Cari file konfigurasi nginx yang aktif untuk sipedas."""
    candidates = (
        glob.glob(f"{NGINX_CONF_DIR}/sites-enabled/*") +
        glob.glob(f"{NGINX_CONF_DIR}/conf.d/*.conf") +
        [f"{NGINX_CONF_DIR}/sites-available/default"]
    )

    # Prioritas: cari yang mengandung "sipedas" atau "kyronix"
    for conf in candidates:
        if os.path.isfile(conf):
            try:
                with open(conf, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                    if "sipedas" in content or "kyronix" in content:
                        return conf
            except Exception:
                pass

    # Fallback: file pertama yang ada
    for conf in candidates:
        if os.path.isfile(conf):
            return conf

    return None


def find_static_root():
    """Cari static root yang valid (ada 502.html di dalamnya)."""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    local_static = os.path.join(base_dir, "backend", "static")

    # Cek local dulu
    if os.path.exists(os.path.join(local_static, "502.html")):
        return local_static

    # Cek server paths
    for root in STATIC_ROOTS:
        if os.path.exists(os.path.join(root, "502.html")):
            return root

    # Cari di path manapun yang ada 502.html
    for root in STATIC_ROOTS:
        os.makedirs(root, exist_ok=True)
        return root

    return local_static


def ensure_502_file(static_root):
    """Pastikan 502.html ada di static root, copy dari project jika perlu."""
    target = os.path.join(static_root, "502.html")
    base_dir = os.path.dirname(os.path.abspath(__file__))
    source = os.path.join(base_dir, "backend", "static", "502.html")

    if os.path.exists(target):
        # Bandingkan checksum sederhana
        try:
            with open(target, "r", encoding="utf-8") as f:
                existing = f.read()
            with open(source, "r", encoding="utf-8") as f:
                new = f.read()
            if existing == new:
                print(f"[OK] 502.html sudah ada dan up-to-date di: {target}")
                return True
            else:
                print(f"[UPDATE] 502.html perlu diperbarui di: {target}")
        except Exception:
            pass

    try:
        shutil.copy2(source, target)
        print(f"[OK] 502.html berhasil di-copy ke: {target}")
        return True
    except Exception as e:
        print(f"[ERROR] Gagal copy 502.html: {e}")
        return False


def inject_nginx_config(conf_path, static_root):
    """Inject error_page directive ke nginx config jika belum ada."""
    with open(conf_path, "r", encoding="utf-8") as f:
        conf_text = f.read()

    # Cek apakah sudah ada
    if "error_page 502" in conf_text and "/502.html" in conf_text:
        print("[INFO] Konfigurasi custom 502 sudah terpasang. Skip.")
        return True

    # Backup
    backup_file = conf_path + ".bak_sipedas"
    with open(backup_file, "w", encoding="utf-8") as f:
        f.write(conf_text)
    print(f"[OK] Backup disimpan di: {backup_file}")

    # Sisipkan sebelum '}' terakhir
    snippet = f"""
    # === [AUTO-CONFIG] CUSTOM 502 SIPEDAS ===
    error_page 502 503 504 /502.html;
    location = /502.html {{
        root {static_root};
        internal;
    }}
    # ========================================
"""
    idx = conf_text.rfind("}")
    if idx == -1:
        print("[ERROR] Nginx config tidak memiliki blok penutup '}'")
        return False

    new_conf = conf_text[:idx] + snippet + conf_text[idx:]
    with open(conf_path, "w", encoding="utf-8") as f:
        f.write(new_conf)

    print("[OK] Konfigurasi 502.html berhasil disisipkan.")
    return True


def test_and_reload():
    """Test nginx syntax dan reload."""
    print("[RUN] Test sintaks nginx...")
    t = subprocess.run(["nginx", "-t"], capture_output=True, text=True)
    if t.returncode != 0:
        print(f"[ERROR] Sintaks nginx bermasalah:\n{t.stderr}")
        # Restore backup
        print("[INFO] Mengembalikan konfigurasi dari backup...")
        subprocess.run(["bash", "-c", f"""
            for f in {NGINX_CONF_DIR}/sites-enabled/*.bak_sipedas {NGINX_CONF_DIR}/conf.d/*.bak_sipedas; do
                if [ -f "$f" ]; then
                    orig="${{f%.bak_sipedas}}"
                    cp "$f" "$orig"
                    echo "Restored: $orig"
                fi
            done
        """])
        return False

    print("[OK] Sintaks nginx valid.")

    print("[RUN] Reload nginx...")
    r = subprocess.run(["systemctl", "reload", "nginx"], capture_output=True, text=True)
    if r.returncode == 0:
        print("[OK] Nginx berhasil di-reload.")
        return True
    else:
        print(f"[WARNING] Reload gagal, coba restart...")
        r2 = subprocess.run(["systemctl", "restart", "nginx"], capture_output=True, text=True)
        if r2.returncode == 0:
            print("[OK] Nginx berhasil di-restart.")
            return True
        print(f"[ERROR] Restart juga gagal: {r2.stderr}")
        return False


def main():
    print("\n" + "=" * 50)
    print("  SETUP CUSTOM 502 NGINX - SIPEDAS BPS KAB. TASIKMALAYA")
    print("=" * 50)

    # 1. Cari static root
    static_root = find_static_root()
    print(f"\n[INFO] Static root: {static_root}")

    # 2. Pastikan 502.html ada
    if not ensure_502_file(static_root):
        print("[FATAL] Tidak bisa menyiapkan 502.html")
        sys.exit(1)

    # 3. Cari nginx config
    conf_path = find_nginx_conf()
    if not conf_path:
        print("[ERROR] Tidak ditemukan file konfigurasi nginx!")
        print("  Pastikan nginx terinstall: sudo apt install nginx")
        sys.exit(1)

    print(f"[INFO] Nginx config: {conf_path}")

    # 4. Inject konfigurasi
    if not inject_nginx_config(conf_path, static_root):
        sys.exit(1)

    # 5. Test & Reload
    if test_and_reload():
        print("\n" + "=" * 50)
        print("  SUKSES! Custom 502 page SIPEDAS aktif.")
        print("  Saat backend mati, pengunjung akan melihat")
        print("  halaman branded SIPEDAS (bukan nginx default).")
        print("=" * 50 + "\n")
    else:
        print("\n[FAILED] Setup gagal. Cek log di atas.")
        sys.exit(1)


if __name__ == "__main__":
    main()
