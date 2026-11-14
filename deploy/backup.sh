#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

TS="$(date +%Y-%m-%d_%H-%M-%S)"
OUT="backups/sipedas-backup_${TS}.dump"
mkdir -p backups

docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > "$OUT"

SIZE="$(wc -c < "$OUT" | tr -d ' ')"
if [ "$SIZE" -lt 100 ]; then
    rm -f "$OUT"
    echo "GAGAL: dump hanya ${SIZE} byte"
    exit 1
fi

find backups -maxdepth 1 -name 'sipedas-backup_*.dump' -mtime +30 -delete
echo "OK: ${OUT} (${SIZE} byte)"
