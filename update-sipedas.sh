#!/bin/bash
# ==============================================================================
# UPDATE SIPEDAS - BPS KABUPATEN TASIKMALAYA
# Jalankan di server: update-sipedas
# atau: bash /var/www/sipedas/update-sipedas.sh
# ==============================================================================

set -e

# === KONFIGURASI ===
PROJECT_DIR="/var/www/sipedas"
STATIC_ROOT="$PROJECT_DIR/backend/static"
SERVICE_NAME="sipedas"  # systemd service name (ganti jika berbeda)
NGINX_CONF=""

# Warna untuk output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo ""
    echo -e "${BLUE}==============================================${NC}"
    echo -e "${BLUE}  UPDATE SIPEDAS - BPS KAB. TASIKMALAYA${NC}"
    echo -e "${BLUE}==============================================${NC}"
    echo ""
}

print_step() {
    echo -e "${BLUE}[$1/$TOTAL_STEPS]${NC} $2"
}

print_ok() {
    echo -e "${GREEN}[OK]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

TOTAL_STEPS=5

print_header

# === STEP 1: Git Pull ===
print_step 1 "Pull latest code from GitHub..."
cd "$PROJECT_DIR"

if git pull origin main; then
    print_ok "Code updated successfully."
else
    print_error "Git pull failed!"
    exit 1
fi

# === STEP 2: Deploy Custom 502 Page ===
print_step 2 "Deploy custom 502 error page..."

# Cari 502.html
SOURCE_502="$PROJECT_DIR/backend/static/502.html"
if [ ! -f "$SOURCE_502" ]; then
    SOURCE_502="$PROJECT_DIR/backend/templates/502.html"
fi

if [ -f "$SOURCE_502" ]; then
    TARGET_502="$STATIC_ROOT/502.html"
    mkdir -p "$STATIC_ROOT"
    
    if [ -f "$TARGET_502" ] && diff -q "$SOURCE_502" "$TARGET_502" > /dev/null 2>&1; then
        print_ok "502.html already up-to-date."
    else
        cp "$SOURCE_502" "$TARGET_502"
        print_ok "502.html deployed to: $TARGET_502"
    fi
    
    # Cari nginx config
    for conf in /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*.conf; do
        if [ -f "$conf" ] && grep -q -E "sipedas|kyronix" "$conf" 2>/dev/null; then
            NGINX_CONF="$conf"
            break
        fi
    done
    
    if [ -z "$NGINX_CONF" ]; then
        for conf in /etc/nginx/sites-enabled/*; do
            if [ -f "$conf" ]; then
                NGINX_CONF="$conf"
                break
            fi
        done
    fi
    
    if [ -n "$NGINX_CONF" ]; then
        # Cek apakah sudah ada config 502
        if grep -q "error_page 502" "$NGINX_CONF" && grep -q "/502.html" "$NGINX_CONF"; then
            print_ok "Nginx custom 502 config already installed."
        else
            print_warn "Injecting custom 502 config into nginx..."
            
            # Backup
            cp "$NGINX_CONF" "${NGINX_CONF}.bak_sipedas"
            
            # Inject
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
" 2>/dev/null && print_ok "Custom 502 config injected." || print_warn "Could not inject 502 config (may need manual setup)."
        fi
    else
        print_warn "Nginx config not found. Skipping 502 config injection."
    fi
else
    print_warn "502.html file not found. Skipping."
fi

# === STEP 3: Install dependencies (if needed) ===
print_step 3 "Check dependencies..."
if [ -f "$PROJECT_DIR/requirements.txt" ]; then
    pip install -r "$PROJECT_DIR/requirements.txt" -q 2>/dev/null && print_ok "Dependencies OK." || print_warn "Some dependencies may need manual install."
else
    print_ok "No requirements.txt found, skipping."
fi

# === STEP 4: Restart Backend ===
print_step 4 "Restarting SIPEDAS backend..."

# Coba restart via systemd
if systemctl restart "$SERVICE_NAME" 2>/dev/null; then
    print_ok "Backend restarted via systemd ($SERVICE_NAME)."
else
    # Coba restart via supervisorctl
    if supervisorctl restart "$SERVICE_NAME" 2>/dev/null; then
        print_ok "Backend restarted via supervisorctl."
    else
        # Cari dan kill proses uvicorn lama, lalu start baru
        print_warn "Trying to restart uvicorn directly..."
        
        # Kill existing uvicorn on port 8001
        OLD_PID=$(lsof -ti:8001 2>/dev/null || true)
        if [ -n "$OLD_PID" ]; then
            kill "$OLD_PID" 2>/dev/null || true
            sleep 2
            print_ok "Old process killed (PID: $OLD_PID)."
        fi
        
        # Start baru di background
        cd "$PROJECT_DIR"
        nohup python -m uvicorn main:app --host 0.0.0.0 --port 8001 > /tmp/sipedas.log 2>&1 &
        NEW_PID=$!
        sleep 3
        
        if kill -0 "$NEW_PID" 2>/dev/null; then
            print_ok "Backend started on port 8001 (PID: $NEW_PID)."
        else
            print_error "Failed to start backend! Check /tmp/sipedas.log"
            exit 1
        fi
    fi
fi

# === STEP 5: Reload Nginx ===
print_step 5 "Reload nginx..."

if nginx -t 2>/dev/null; then
    if systemctl reload nginx 2>/dev/null; then
        print_ok "Nginx reloaded."
    else
        systemctl restart nginx 2>/dev/null && print_ok "Nginx restarted." || print_warn "Nginx reload failed."
    fi
else
    print_warn "Nginx config test failed. Skipping reload."
fi

# === Selesai ===
echo ""
echo -e "${GREEN}==============================================${NC}"
echo -e "${GREEN}  UPDATE BERHASIL!${NC}"
echo -e "${GREEN}==============================================${NC}"
echo ""
echo "  SIPEDAS updated to latest version."
echo "  Backend: Running on port 8001"
echo "  Custom 502 page: Active"
echo ""
echo "  Refresh your browser to see changes."
echo ""
