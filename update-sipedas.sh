#!/bin/bash
# =============================================================================
# UPDATE SIPEDAS - BPS KABUPATEN TASIKMALAYA
#
# Pemakaian di server:
#     update-sipedas
#
# Atau langsung:
#     bash /var/www/sipedas/update-sipedas.sh
#
# Alur:
#   1. git pull
#   2. dependensi  (HANYA bila requirements.txt berubah di pull ini)
#   3. restart backend
#   4. tunggu GET /health sampai backend benar-benar siap
#   5. validasi + reload nginx
#   6. cek blok halaman 502 masih ada
#   7. verifikasi lewat domain publik
#
# Catatan: git pull dilakukan DI SINI (bukan di wrapper) lalu script
# menjalankan ulang dirinya sendiri, agar tidak pernah mengeksekusi
# berkas yang sedang berubah di tengah jalan.
# =============================================================================

set -euo pipefail

PROJECT_DIR="/var/www/sipedas"
VENV_DIR="$PROJECT_DIR/venv"
SERVICE_NAME="sipedas"
HEALTH_URL="http://127.0.0.1:8000/health"
HEALTH_TIMEOUT=30
PUBLIC_BASE="https://sipedas.kyronix.my.id"
NGINX_ENABLED="/etc/nginx/sites-enabled"
NGINX_AVAILABLE="/etc/nginx/sites-available"

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
BLUE=$'\033[0;34m'
NC=$'\033[0m'

TOTAL_STEPS=7
WARN_COUNT=0
FAIL_COUNT=0

hdr() {
    printf "\n%s==============================================%s\n" "$BLUE" "$NC"
    printf "%s  UPDATE SIPEDAS - BPS KAB. TASIKMALAYA%s\n" "$BLUE" "$NC"
    printf "%s==============================================%s\n\n" "$BLUE" "$NC"
}

step() {
    printf "%s[%d/%d]%s %s\n" "$BLUE" "$STEP" "$TOTAL_STEPS" "$NC" "$1"
    STEP=$((STEP + 1))
}

ok()   { printf "  %s[OK]%s %s\n" "$GREEN" "$NC" "$1"; }
note() { printf "  %s[..]%s %s\n" "$BLUE" "$NC" "$1"; }

warn() {
    WARN_COUNT=$((WARN_COUNT + 1))
    printf "  %s[PERINGATAN]%s %s\n" "$YELLOW" "$NC" "$1"
}

err() {
    FAIL_COUNT=$((FAIL_COUNT + 1))
    printf "  %s[GAGAL]%s %s\n" "$RED" "$NC" "$1"
}

# -----------------------------------------------------------------------------
# Pra-pemeriksaan (tanpa nomor langkah): gagal cepat dengan pesan jelas
# -----------------------------------------------------------------------------
SELF="$(readlink -f "$0" 2>/dev/null || printf '%s' "$0")"

if [ ! -d "$PROJECT_DIR" ]; then
    printf "  %s[GAGAL]%s direktori proyek tidak ada: %s\n" "$RED" "$NC" "$PROJECT_DIR"
    exit 1
fi
if [ ! -x "$VENV_DIR/bin/python" ]; then
    printf "  %s[GAGAL]%s venv tidak ditemukan: %s\n" "$RED" "$NC" "$VENV_DIR"
    printf "         Buat dengan: python3 -m venv %s\n" "$VENV_DIR"
    exit 1
fi
if ! systemctl cat "$SERVICE_NAME.service" >/dev/null 2>&1; then
    printf "  %s[GAGAL]%s unit systemd tidak ditemukan: %s.service\n" "$RED" "$NC" "$SERVICE_NAME"
    exit 1
fi
if ! git -C "$PROJECT_DIR" rev-parse --git-dir >/dev/null 2>&1; then
    printf "  %s[GAGAL]%s bukan repositori git: %s\n" "$RED" "$NC" "$PROJECT_DIR"
    exit 1
fi

if [ "${UPDATE_SIPEDAS_REEXEC:-0}" = "1" ]; then
    STEP=2   # tahap 1 (git pull) sudah selesai sebelum menjalankan ulang
else
    STEP=1
fi

hdr

# -----------------------------------------------------------------------------
# TAHAP 1 - git pull, lalu jalankan ulang diri sendiri bila file berubah
# -----------------------------------------------------------------------------
if [ "$STEP" -eq 1 ]; then
    step "Tarik kode terbaru dari GitHub"

    OLD_HEAD="$(git -C "$PROJECT_DIR" rev-parse HEAD)"

    if PULL_OUT="$(git -C "$PROJECT_DIR" pull origin main 2>&1)"; then
        if [ -n "$PULL_OUT" ]; then
            printf '%s\n' "$PULL_OUT" | sed 's/^/         /'
        fi
    else
        err "git pull gagal."
        if [ -n "$PULL_OUT" ]; then
            printf '%s\n' "$PULL_OUT" | sed 's/^/         /'
        fi
        printf '         Kalau pesannya "divergent histories", jalankan sekali:\n'
        printf '           cd %s && git fetch origin && git reset --hard origin/main\n' "$PROJECT_DIR"
        printf '         (tidak menghapus .env, venv/, backups/, auth_credentials.json)\n'
        exit 1
    fi

    NEW_HEAD="$(git -C "$PROJECT_DIR" rev-parse HEAD)"
    export UPDATE_SIPEDAS_OLD_HEAD="$OLD_HEAD"
    export UPDATE_SIPEDAS_NEW_HEAD="$NEW_HEAD"

    if [ "$OLD_HEAD" != "$NEW_HEAD" ]; then
        ok "Kode diperbarui: ${OLD_HEAD:0:7} -> ${NEW_HEAD:0:7}"
        printf "     Menjalankan ulang dengan versi terbaru...\n"
        export UPDATE_SIPEDAS_REEXEC=1
        exec bash "$SELF"
    fi

    ok "Sudah yang terbaru (${NEW_HEAD:0:7})."
fi

# -----------------------------------------------------------------------------
# TAHAP 2 - dependensi (hanya bila requirements.txt berubah)
# -----------------------------------------------------------------------------
step "Periksa dependensi Python (venv)"

REQ_FILE="$PROJECT_DIR/requirements.txt"

if [ ! -f "$REQ_FILE" ]; then
    warn "requirements.txt tidak ada - dilewati."
elif [ -z "${UPDATE_SIPEDAS_OLD_HEAD:-}" ] || [ -z "${UPDATE_SIPEDAS_NEW_HEAD:-}" ]; then
    note "Tidak ada info pull - memasang dependensi penuh."
    if "$VENV_DIR/bin/pip" install -r "$REQ_FILE"; then
        ok "Dependensi terpasang."
    else
        err "pip install gagal."
        exit 1
    fi
elif git -C "$PROJECT_DIR" diff --name-only \
        "$UPDATE_SIPEDAS_OLD_HEAD" "$UPDATE_SIPEDAS_NEW_HEAD" \
        -- requirements.txt | grep -q .; then
    ok "requirements.txt berubah - memasang dependensi..."
    if "$VENV_DIR/bin/pip" install -r "$REQ_FILE"; then
        ok "Dependensi selesai dipasang."
    else
        err "pip install gagal."
        exit 1
    fi
else
    ok "requirements.txt tidak berubah - dilewati."
fi

# -----------------------------------------------------------------------------
# TAHAP 3 - restart backend
# -----------------------------------------------------------------------------
step "Restart backend ($SERVICE_NAME)"

if systemctl restart "$SERVICE_NAME"; then
    ok "Service direstart."
else
    err "systemctl restart gagal."
    printf '         --- journalctl -u %s -n 30 ---\n' "$SERVICE_NAME"
    journalctl -u "$SERVICE_NAME" -n 30 --no-pager 2>/dev/null | sed 's/^/         /' || true
    exit 1
fi

# -----------------------------------------------------------------------------
# TAHAP 4 - tunggu backend benar-benar siap (WAJIB, cegah halaman 502)
# -----------------------------------------------------------------------------
step "Tunggu backend siap (maks ${HEALTH_TIMEOUT}s)"

READY=0
for i in $(seq 1 "$HEALTH_TIMEOUT"); do
    if curl -sf -o /dev/null --max-time 3 "$HEALTH_URL"; then
        READY=1
        ok "Backend siap dalam ${i}s."
        break
    fi
    sleep 1
done

if [ "$READY" -ne 1 ]; then
    err "Backend tidak menjawab dalam ${HEALTH_TIMEOUT}s."
    printf '         --- journalctl -u %s -n 30 ---\n' "$SERVICE_NAME"
    journalctl -u "$SERVICE_NAME" -n 30 --no-pager 2>/dev/null | sed 's/^/         /' || true
    exit 1
fi

# -----------------------------------------------------------------------------
# TAHAP 5 - validasi + reload nginx
# -----------------------------------------------------------------------------
step "Validasi dan reload konfigurasi nginx"

if nginx -t >/dev/null 2>&1; then
    if systemctl reload nginx; then
        ok "Nginx direload."
    else
        err "systemctl reload nginx gagal."
        exit 1
    fi
else
    warn "nginx -t GAGAL - reload dilewati (konfigurasi lama tetap berjalan)."
    nginx -t 2>&1 | sed 's/^/         /' || true
fi

# -----------------------------------------------------------------------------
# TAHAP 6 - pastikan blok halaman 502 tidak hilang
# -----------------------------------------------------------------------------
step "Cek blok halaman 502 di konfigurasi nginx"

VHOST=""
for cand in "$NGINX_ENABLED/sipedas" "$NGINX_AVAILABLE/sipedas"; do
    if [ -f "$cand" ]; then
        VHOST="$cand"
        break
    fi
done

if [ -z "$VHOST" ]; then
    warn "Berkas vhost sipedas tidak ditemukan di $NGINX_ENABLED maupun $NGINX_AVAILABLE."
elif grep -q "error_page 502" "$VHOST" 2>/dev/null \
        && grep -q "location = /502.html" "$VHOST" 2>/dev/null; then
    ok "Blok error_page 502 ada di $VHOST"

    if grep -A3 "location = /502.html" "$VHOST" | grep -q "frontend/static"; then
        ok "root halaman 502 menunjuk frontend/static."
    else
        warn "root halaman 502 TIDAK menunjuk frontend/static - periksa manual:"
        grep -A3 "location = /502.html" "$VHOST" | sed 's/^/         /'
    fi
else
    warn "Blok error_page 502 HILANG dari $VHOST"
    warn "Halaman 502 kustom tidak akan tampil bila backend mati. Perbaiki manual."
fi

# -----------------------------------------------------------------------------
# TAHAP 7 - verifikasi lewat domain publik
# -----------------------------------------------------------------------------
step "Verifikasi lewat domain publik"

check_http() {
    local path="$1"
    local expect="$2"
    local got
    got="$(curl -so /dev/null -w '%{http_code}' --max-time 20 "$PUBLIC_BASE$path" 2>/dev/null || printf 'ERR')"
    if [ "$got" = "$expect" ]; then
        ok "$path -> $got"
    else
        err "$path -> $got (diharapkan $expect)"
    fi
}

check_http "/health" "200"
check_http "/login"  "200"
check_http "/docs"   "404"

# -----------------------------------------------------------------------------
# Ringkasan
# -----------------------------------------------------------------------------
printf "\n"
printf "%s==============================================%s\n" "$BLUE" "$NC"

if [ "$FAIL_COUNT" -eq 0 ] && [ "$WARN_COUNT" -eq 0 ]; then
    printf "%s  UPDATE BERHASIL%s\n" "$GREEN" "$NC"
elif [ "$FAIL_COUNT" -eq 0 ]; then
    printf "%s  UPDATE BERHASIL%s " "$GREEN" "$NC"
    printf "%s(dengan %d peringatan)%s\n" "$YELLOW" "$WARN_COUNT" "$NC"
else
    printf "%s  UPDATE SEBAGIAN GAGAL%s (%d masalah)\n" "$RED" "$NC" "$FAIL_COUNT"
fi

printf "%s==============================================%s\n" "$BLUE" "$NC"
printf "\n"
printf "  Kode     : %s\n" "$(git -C "$PROJECT_DIR" rev-parse --short HEAD)"
printf "  Backend  : port 8000 (systemd: %s.service)\n" "$SERVICE_NAME"
printf "  Health   : %s\n" "$HEALTH_URL"

if [ "$FAIL_COUNT" -gt 0 ]; then
    exit 1
fi

if [ "$WARN_COUNT" -gt 0 ]; then
    exit 0
fi

printf "  Status   : %ssemua hijau%s - muat ulang browser bila perubahan belum terlihat.\n" "$GREEN" "$NC"
