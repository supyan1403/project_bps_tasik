#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
BLUE=$'\033[0;34m'
NC=$'\033[0m'

ok()   { printf "  %s[OK]%s %s\n" "$GREEN" "$NC" "$1"; }
note() { printf "  %s[..]%s %s\n" "$BLUE" "$NC" "$1"; }
fail() { printf "  %s[GAGAL]%s %s\n" "$RED" "$NC" "$1"; exit 1; }

SKIP_PUBLIC=0
if [ "${1:-}" = "--skip-public" ]; then
    SKIP_PUBLIC=1
fi

[ -f .env ] || fail ".env tidak ada — buat dulu (isi POSTGRES_PASSWORD)"
command -v docker >/dev/null 2>&1 || fail "docker tidak tersedia"
docker compose version >/dev/null 2>&1 || fail "docker compose tidak tersedia"

printf "%s=== DEPLOY SIPEDAS ===%s\n" "$BLUE" "$NC"

note "Tarik kode terbaru dari GitHub"
git checkout -- frontend/static/js 2>/dev/null || true
OLD_HEAD="$(git rev-parse HEAD)"
if ! PULL_OUT="$(git pull origin main 2>&1)"; then
    printf '%s\n' "$PULL_OUT"
    fail "git pull gagal. Bila divergent: git fetch origin && git reset --hard origin/main"
fi
NEW_HEAD="$(git rev-parse HEAD)"
ok "Kode: ${OLD_HEAD:0:7} -> ${NEW_HEAD:0:7}"

note "Bangun image Docker"
docker compose build
ok "Image selesai dibangun"

note "Jalankan kontainer"
docker compose up -d
ok "Kontainer berjalan"

note "Tunggu backend siap (maks 60 detik)"
READY=0
for i in $(seq 1 60); do
    if curl -sf -o /dev/null --max-time 3 http://127.0.0.1/health; then
        READY=1
        ok "Backend siap dalam ${i}s"
        break
    fi
    sleep 1
done
if [ "$READY" -ne 1 ]; then
    docker compose logs --tail 40 web
    fail "Backend tidak menjawab dalam 60 detik"
fi

if [ "$SKIP_PUBLIC" -eq 1 ]; then
    ok "Verifikasi publik dilewati (--skip-public)"
else
    SCHEME="http"
    if docker compose exec -T proxy test -f /etc/letsencrypt/live/sipedas.kyronix.my.id/fullchain.pem 2>/dev/null; then
        SCHEME="https"
    fi
    note "Verifikasi publik via ${SCHEME}://sipedas.kyronix.my.id"
    check_http() {
        local path="$1"
        local expect="$2"
        local got
        got="$(curl -so /dev/null -w '%{http_code}' --max-time 20 "${SCHEME}://sipedas.kyronix.my.id${path}" 2>/dev/null || printf 'ERR')"
        if [ "$got" = "$expect" ]; then
            ok "${path} -> ${got}"
        else
            fail "${path} -> ${got} (diharapkan ${expect})"
        fi
    }
    check_http "/health" "200"
    check_http "/login"  "200"
    check_http "/docs"   "404"
fi

printf "%s=== DEPLOY BERHASIL%s (%s)%s\n" "$GREEN" "${NEW_HEAD:0:7}" "$NC" "$NC"
