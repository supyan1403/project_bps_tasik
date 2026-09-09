#!/usr/bin/env python3
import os
import glob
import subprocess
import sys

def run():
    print("\n==========================================")
    print("  SETUP OTOMATIS CUSTOM 502 NGINX SIPEDAS")
    print("==========================================")

    # 1. Cari file 502.html
    base_dir = os.path.dirname(os.path.abspath(__file__))
    static_dir = os.path.join(base_dir, "backend", "static")
    target_502 = os.path.join(static_dir, "502.html")

    if not os.path.exists(target_502):
        print(f"[ERROR] File 502.html tidak ditemukan di: {target_502}")
        sys.exit(1)

    print(f"[OK] Folder static ditemukan: {static_dir}")

    # 2. Cari file konfigurasi Nginx untuk sipedas
    nginx_candidates = (
        glob.glob("/etc/nginx/sites-enabled/*") +
        glob.glob("/etc/nginx/conf.d/*.conf") +
        ["/etc/nginx/sites-available/default"]
    )
    
    selected_conf = None
    for conf in nginx_candidates:
        if os.path.isfile(conf):
            try:
                with open(conf, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                    if "sipedas" in content or "kyronix" in content:
                        selected_conf = conf
                        break
            except Exception:
                pass

    if not selected_conf:
        # Fallback ke default sites-enabled jika tidak ditemukan kata kunci
        for conf in nginx_candidates:
            if os.path.isfile(conf):
                selected_conf = conf
                break

    if not selected_conf:
        print("[ERROR] Tidak dapat menemukan file konfigurasi Nginx di /etc/nginx/")
        sys.exit(1)

    print(f"[OK] File konfigurasi Nginx ditemukan: {selected_conf}")

    # 3. Baca dan cek isi file
    with open(selected_conf, "r", encoding="utf-8") as f:
        conf_text = f.read()

    if "/502.html" in conf_text:
        print("[INFO] Konfigurasi /502.html sudah pernah terpasang sebelumnya.")
    else:
        # Buat backup sebelum modifikasi
        backup_file = selected_conf + ".bak_sipedas"
        with open(backup_file, "w", encoding="utf-8") as f:
            f.write(conf_text)
        print(f"[OK] Backup konfigurasi disimpan di: {backup_file}")

        # Sisipkan sebelum tanda kurung kurawal '}' terakhir dari blok server
        snippet = f"""
    # === [AUTO-CONFIG] CUSTOM 502 SIPEDAS ===
    error_page 502 503 504 /502.html;
    location = /502.html {{
        root {static_dir};
        internal;
    }}
    # ========================================
"""
        idx = conf_text.rfind("}")
        if idx == -1:
            print("[ERROR] Format konfigurasi Nginx tidak memiliki blok penutup '}'")
            sys.exit(1)

        new_conf_text = conf_text[:idx] + snippet + conf_text[idx:]
        with open(selected_conf, "w", encoding="utf-8") as f:
            f.write(new_conf_text)
        print("[OK] Berhasil menyisipkan aturan 502.html ke konfigurasi Nginx.")

    # 4. Tes sintaks Nginx
    print("[RUN] Menguji sintaks konfigurasi Nginx (nginx -t)...")
    t = subprocess.run(["nginx", "-t"], capture_output=True, text=True)
    if t.returncode != 0:
        print("[ERROR] Sintaks Nginx bermasalah!")
        print(t.stderr)
        # Kembalikan backup jika ada
        backup_file = selected_conf + ".bak_sipedas"
        if os.path.exists(backup_file):
            with open(backup_file, "r", encoding="utf-8") as f:
                orig = f.read()
            with open(selected_conf, "w", encoding="utf-8") as f:
                f.write(orig)
            print("[INFO] Konfigurasi telah dikembalikan ke kondisi semula.")
        sys.exit(1)

    print("[OK] Sintaks Nginx valid.")

    # 5. Reload Nginx
    print("[RUN] Menerapkan perubahan (systemctl reload nginx)...")
    r = subprocess.run(["systemctl", "reload", "nginx"], capture_output=True, text=True)
    if r.returncode == 0:
        print("\n🎉 SUKSES BESAR! Nginx berhasil diperbarui dan dimuat ulang.")
        print("Mulai sekarang, saat backend offline/restart, pengunjung akan melihat halaman 502 SIPEDAS resmi secara alami.")
    else:
        print(f"[WARNING] Gagal reload nginx: {r.stderr}")

if __name__ == "__main__":
    run()
