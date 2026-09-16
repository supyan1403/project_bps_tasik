#!/bin/bash
# Forwarder otomatis ke deploy/update-sipedas.sh untuk kompatibilitas server VPS
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$SCRIPT_DIR/deploy/update-sipedas.sh" "$@"
