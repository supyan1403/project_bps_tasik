#!/bin/bash
# ==============================================================================
# DEPLOY CUSTOM 502 PAGE - SIPEDAS BPS KABUPATEN TASIKMALAYA
# Jalankan di server: bash deploy-502.sh
# ==============================================================================

set -e

echo ""
echo "=============================================="
echo "  DEPLOY CUSTOM 502 PAGE - SIPEDAS"
echo "=============================================="

# === KONFIGURASI ===
PROJECT_DIR="/var/www/sipedas"
STATIC_ROOT="$PROJECT_DIR/backend/static"
NGINX_CONF=""

# === 1. Cari nginx config ===
echo ""
echo "[1/5] Mencari konfigurasi nginx..."

for conf in /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*.conf; do
    if [ -f "$conf" ] && grep -q -E "sipedas|kyronix" "$conf" 2>/dev/null; then
        NGINX_CONF="$conf"
        break
    fi
done

# Fallback ke sites-enabled pertama
if [ -z "$NGINX_CONF" ]; then
    for conf in /etc/nginx/sites-enabled/*; do
        if [ -f "$conf" ]; then
            NGINX_CONF="$conf"
            break
        fi
    done
fi

if [ -z "$NGINX_CONF" ]; then
    echo "[ERROR] Tidak ditemukan konfigurasi nginx untuk sipedas!"
    exit 1
fi

echo "[OK] Nginx config: $NGINX_CONF"

# === 2. Pastikan 502.html ada ===
echo ""
echo "[2/5] Memeriksa file 502.html..."

# Cari 502.html dari project
SOURCE_502="$PROJECT_DIR/backend/static/502.html"
if [ ! -f "$SOURCE_502" ]; then
    SOURCE_502="$PROJECT_DIR/backend/templates/502.html"
fi

if [ ! -f "$SOURCE_502" ]; then
    echo "[ERROR] File 502.html tidak ditemukan di project!"
    exit 1
fi

# Pastikan static root ada
mkdir -p "$STATIC_ROOT"

# Copy jika belum ada atau berbeda
TARGET_502="$STATIC_ROOT/502.html"
if [ -f "$TARGET_502" ] && diff -q "$SOURCE_502" "$TARGET_502" > /dev/null 2>&1; then
    echo "[OK] 502.html sudah ada dan up-to-date."
else
    cp "$SOURCE_502" "$TARGET_502"
    echo "[OK] 502.html berhasil di-deploy ke: $TARGET_502"
fi

# === 3. Cek dan inject nginx config ===
echo ""
echo "[3/5] Memeriksa konfigurasi nginx..."

if grep -q "error_page 502" "$NGINX_CONF" && grep -q "/502.html" "$NGINX_CONF"; then
    echo "[OK] Konfigurasi custom 502 sudah terpasang."
else
    echo "[SETUP] Menyisipkan konfigurasi custom 502..."

    # Backup
    cp "$NGINX_CONF" "${NGINX_CONF}.bak_sipedas"
    echo "[OK] Backup: ${NGINX_CONF}.bak_sipedas"

    # Sisipkan sebelum '}' terakhir
    # Gunakan python untuk insertion yang aman
    python3 -c "
import sys
conf = '$NGINX_CONF'
static = '$STATIC_ROOT'

with open(conf, 'r') as f:
    text = f.read()

snippet = '''
    # === [AUTO-CONFIG] CUSTOM 502 SIPEDAS ===
    error_page 502 503 504 /502.html;
    location = /502.html {{
        root {static};
        internal;
    }}
    # ========================================
'''

idx = text.rfind('}')
if idx == -1:
    print('[ERROR] Nginx config invalid')
    sys.exit(1)

new = text[:idx] + snippet + text[idx:]
with open(conf, 'w') as f:
    f.write(new)

print('[OK] Konfigurasi berhasil disisipkan.')
"

    if [ $? -ne 0 ]; then
        echo "[ERROR] Gagal menyisipkan konfigurasi!"
        # Restore backup
        cp "${NGINX_CONF}.bak_sipedas" "$NGINX_CONF"
        exit 1
    fi
fi

# === 4. Test nginx ===
echo ""
echo "[4/5] Test sintaks nginx..."
if nginx -t 2>&1; then
    echo "[OK] Sintaks nginx valid."
else
    echo "[ERROR] Sintaks nginx bermasalah!"
    echo "[RESTORE] Mengembalikan backup..."
    cp "${NGINX_CONF}.bak_sipedas" "$NGINX_CONF"
    exit 1
fi

# === 5. Reload nginx ===
echo ""
echo "[5/5] Reload nginx..."
if systemctl reload nginx 2>&1; then
    echo "[OK] Nginx berhasil di-reload."
else
    echo "[WARN] Reload gagal, mencoba restart..."
    if systemctl restart nginx 2>&1; then
        echo "[OK] Nginx berhasil di-restart."
    else
        echo "[ERROR] Restart juga gagal!"
        exit 1
    fi
fi

# === Selesai ===
echo ""
echo "=============================================="
echo "  DEPLOY BERHASIL!"
echo ""
echo "  Custom 502 page SIPEDAS sekarang aktif."
echo "  Saat backend mati, pengunjung akan melihat"
echo "  halaman branded (bukan nginx default)."
echo "=============================================="
echo ""
