import os
import json
import secrets
import hashlib
import time
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Request, Response, Depends, Cookie
from sqlalchemy.orm import Session

import models
from database import get_db

router = APIRouter(prefix="/api/auth", tags=["Auth"])

# Configuration paths
_CONFIG_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
os.makedirs(_CONFIG_DIR, exist_ok=True)
_AUTH_CONFIG_FILE = os.path.join(_CONFIG_DIR, "auth_credentials.json")

SESSION_MAX_AGE_HOURS = 8

# Brute-force tracking: {ip_address: {"failed_count": int, "lock_until": float}}
_login_attempts = {}
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION_SECONDS = 300  # 5 menit

def _get_client_ip(request: Request) -> str:
    """Ambil IP asli dari X-Forwarded-For (reverse proxy) atau direct connection."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

def _hash_password(plain_password: str, salt: bytes = None) -> tuple[str, str]:
    """Mengenkripsi password menggunakan PBKDF2-HMAC-SHA256 dengan random salt 16-byte."""
    if salt is None:
        salt = secrets.token_bytes(16)
    hashed = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, 100_000)
    return hashed.hex(), salt.hex()

def _verify_password(plain_password: str, stored_hash_hex: str, stored_salt_hex: str) -> bool:
    """Verifikasi kecocokan password dengan hash tersimpan (constant-time compare)."""
    try:
        salt = bytes.fromhex(stored_salt_hex)
        computed_hash = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, 100_000).hex()
        return secrets.compare_digest(computed_hash, stored_hash_hex)
    except Exception:
        return False

def _get_or_create_admin_credentials():
    """Mengambil kredensial hash admin atau inisialisasi default terenkripsi."""
    if os.path.exists(_AUTH_CONFIG_FILE):
        try:
            with open(_AUTH_CONFIG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if "password_hash" in data and "salt" in data:
                    return data["password_hash"], data["salt"]
        except Exception:
            pass

    # Wajib set env var SIPEDAS_ADMIN_PASSWORD di production
    default_plain = os.environ.get("SIPEDAS_ADMIN_PASSWORD")
    if not default_plain:
        print("[WARNING] SIPEDAS_ADMIN_PASSWORD belum di-set. Menggunakan default sementara.")
        default_plain = "ganti_password_saya"
    p_hash, salt = _hash_password(default_plain)
    try:
        with open(_AUTH_CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump({"password_hash": p_hash, "salt": salt, "updated_at": datetime.now().isoformat()}, f, indent=2)
    except Exception as e:
        print(f"Warning: Failed to save auth credentials: {e}")
    return p_hash, salt

def _update_admin_password(new_plain_password: str):
    p_hash, salt = _hash_password(new_plain_password)
    with open(_AUTH_CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump({"password_hash": p_hash, "salt": salt, "updated_at": datetime.now().isoformat()}, f, indent=2)

def _clean_expired_sessions(db: Session):
    cutoff = datetime.utcnow() - timedelta(hours=SESSION_MAX_AGE_HOURS)
    db.query(models.UserSession).filter(models.UserSession.last_active < cutoff).delete()
    db.commit()

def create_session(role: str = "admin", db: Session = None) -> str:
    sid = secrets.token_hex(32)
    now = datetime.utcnow()
    if db:
        session = models.UserSession(id=sid, role=role, created_at=now, last_active=now)
        db.add(session)
        db.commit()
    return sid

def destroy_session(session_id: str, db: Session = None):
    if db and session_id:
        db.query(models.UserSession).filter(models.UserSession.id == session_id).delete()
        db.commit()

def get_current_role(session_id: str = Cookie(None, alias="sipedas_session"), db: Session = Depends(get_db)):
    if session_id:
        sess = db.query(models.UserSession).filter(models.UserSession.id == session_id).first()
        if sess:
            sess.last_active = datetime.utcnow()
            db.commit()
            return sess.role
    return "pegawai"

def require_admin(request: Request, db: Session = Depends(get_db)):
    session_id = request.cookies.get("sipedas_session")
    if not session_id:
        raise HTTPException(status_code=401, detail="Unauthorized: silakan login sebagai admin.")
    sess = db.query(models.UserSession).filter(models.UserSession.id == session_id).first()
    if not sess:
        raise HTTPException(status_code=401, detail="Unauthorized: silakan login sebagai admin.")
    sess.last_active = datetime.utcnow()
    db.commit()
    return {"role": sess.role}

def log_activity(db: Session, action: str, target: str = "", detail: dict = None):
    """Catat aktivitas admin ke database."""
    log = models.ActivityLog(action=action, target=target, detail=detail or {})
    db.add(log)
    db.commit()

@router.post("/login")
def auth_login(payload: dict, request: Request, response: Response, db: Session = Depends(get_db)):
    client_ip = _get_client_ip(request)
    now_ts = time.time()

    # 1. Periksa Lockout Rate Limiter
    attempt_info = _login_attempts.get(client_ip, {"failed_count": 0, "lock_until": 0})
    if attempt_info["lock_until"] > now_ts:
        remaining_sec = int(attempt_info["lock_until"] - now_ts)
        raise HTTPException(
            status_code=429,
            detail=f"Terlalu banyak percobaan login yang gagal. Akun dikunci sementara. Coba lagi dalam {remaining_sec} detik."
        )

    password = str(payload.get("password", "")).strip()
    stored_hash, stored_salt = _get_or_create_admin_credentials()

    # 2. Verifikasi Password Hashing
    if not _verify_password(password, stored_hash, stored_salt):
        attempt_info["failed_count"] += 1
        if attempt_info["failed_count"] >= MAX_FAILED_ATTEMPTS:
            attempt_info["lock_until"] = now_ts + LOCKOUT_DURATION_SECONDS
            _login_attempts[client_ip] = attempt_info
            raise HTTPException(
                status_code=429,
                detail=f"Password salah 5 kali berturut-turut. Akses dikunci selama {LOCKOUT_DURATION_SECONDS // 60} menit demi keamanan."
            )
        _login_attempts[client_ip] = attempt_info
        sisa = MAX_FAILED_ATTEMPTS - attempt_info["failed_count"]
        raise HTTPException(status_code=401, detail=f"Password salah! Sisa percobaan: {sisa} kali.")

    # 3. Login Sukses: Reset Rate Limiter & Buat Sesi di database
    _login_attempts.pop(client_ip, None)
    _clean_expired_sessions(db)
    sid = create_session("admin", db)
    response.set_cookie(
        key="sipedas_session",
        value=sid,
        httponly=True,
        secure=bool(os.environ.get("SIPEDAS_DOMAIN")),
        samesite="lax",
        max_age=SESSION_MAX_AGE_HOURS * 3600,
        path="/",
    )
    return {"role": "admin", "message": "Login admin berhasil.", "session_expires_in_hours": SESSION_MAX_AGE_HOURS}

@router.post("/logout")
def auth_logout(request: Request, response: Response, db: Session = Depends(get_db)):
    session_id = request.cookies.get("sipedas_session")
    if session_id:
        destroy_session(session_id, db)
    response.delete_cookie("sipedas_session", path="/")
    return {"role": "pegawai", "message": "Logout berhasil."}

@router.get("/me")
def auth_me(request: Request, db: Session = Depends(get_db)):
    session_id = request.cookies.get("sipedas_session")
    if session_id:
        sess = db.query(models.UserSession).filter(models.UserSession.id == session_id).first()
        if sess:
            return {"role": sess.role}
    return {"role": "pegawai"}

@router.post("/change-password")
def change_password(payload: dict, db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    """Fitur ganti password admin yang aman."""
    old_password = str(payload.get("old_password", "")).strip()
    new_password = str(payload.get("new_password", "")).strip()

    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password baru minimal harus 6 karakter!")

    stored_hash, stored_salt = _get_or_create_admin_credentials()
    if not _verify_password(old_password, stored_hash, stored_salt):
        raise HTTPException(status_code=401, detail="Password lama Anda salah!")

    _update_admin_password(new_password)
    log_activity(db, "change_admin_password", "Admin mengganti password sistem")
    return {"message": "Password admin berhasil diperbarui dengan aman."}

# =====================================================================
# MAINTENANCE MODE TOGGLE — hanya admin
# =====================================================================

@router.post("/maintenance")
def toggle_maintenance(payload: dict, db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    """Aktifkan/nonaktifkan maintenance mode. Hanya admin."""
    from main import _update_maintenance_db, _maintenance_cache

    mode = str(payload.get("mode", "")).strip()
    end_time = str(payload.get("end_time", "")).strip()

    if mode not in ("1", "0"):
        raise HTTPException(status_code=400, detail="mode harus '1' (aktif) atau '0' (nonaktif)")

    if mode == "1" and not end_time:
        raise HTTPException(status_code=400, detail="end_time wajib diisi saat mengaktifkan maintenance (ISO format)")

    _update_maintenance_db(mode, end_time)
    _maintenance_cache["ts"] = 0  # force refresh

    log_activity(db, "toggle_maintenance", f"Mode: {'ON' if mode == '1' else 'OFF'}", {"end_time": end_time})
    return {"mode": mode, "end_time": end_time, "message": "Maintenance mode berhasil diupdate."}

@router.get("/maintenance")
def get_maintenance_status(db: Session = Depends(get_db)):
    """Cek status maintenance mode (public — untuk halaman maintenance)."""
    from main import _is_maintenance, _maintenance_cache, _maintenance_end
    _maintenance_cache["ts"] = 0
    is_maint = _is_maintenance()
    return {"mode": "1" if is_maint else "0", "end_time": _maintenance_end()}
