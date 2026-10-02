import hashlib
import json
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import models
from database import get_db
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Auth"])

# Configuration paths
_CONFIG_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
try:
    os.makedirs(_CONFIG_DIR, exist_ok=True)
except OSError as e:
    logger.warning(f"Gagal membuat direktori config: {e}")
_AUTH_CONFIG_FILE = os.path.join(_CONFIG_DIR, "auth_credentials.json")

SESSION_MAX_AGE_HOURS = 8

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION_SECONDS = 300  # 5 menit
ATTEMPT_PRUNE_AFTER_HOURS = 24

def _now() -> datetime:
    """Waktu sekarang sebagai UTC naive (kompatibel kolom DateTime SQLAlchemy)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)

def _get_client_ip(request: Request) -> str:
    """Ambil IP asli dari header yang DITIMPA proxy, bukan yang dikirim klien."""
    real_ip = request.headers.get("x-real-ip")
    if real_ip and real_ip.strip():
        # nginx: proxy_set_header X-Real-IP $remote_addr -> ditimpa, tak bisa dipalsukan
        return real_ip.strip()
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded and forwarded.strip():
        # $proxy_add_x_forwarded_for MENG-APPEND, jadi hop terakhir = ip asli
        return forwarded.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"

def _get_login_attempt(db: Session, ip: str) -> models.LoginAttempt | None:
    """Ambil catatan percobaan login per IP; reset hitungan bila sudah diam tanpa kegagalan."""
    attempt = db.query(models.LoginAttempt).filter(models.LoginAttempt.ip == ip).first()
    if attempt is None:
        return None
    now = _now()
    if attempt.last_failed_at and (now - attempt.last_failed_at) > timedelta(seconds=LOCKOUT_DURATION_SECONDS):
        # "5 kali berturut-turut" -> hitungan direset kalau sudah lewat jendela lockout
        attempt.failed_count = 0
        attempt.lock_until = None
        attempt.last_failed_at = now
        db.commit()
    return attempt

def _prune_login_attempts(db: Session, now: datetime) -> None:
    """Buang catatan percobaan lama. Lock maksimal 5 menit, jadi lewat 24 jam aman dihapus."""
    db.query(models.LoginAttempt).filter(
        models.LoginAttempt.last_failed_at < now - timedelta(hours=ATTEMPT_PRUNE_AFTER_HOURS)
    ).delete(synchronize_session=False)

def _hash_password(plain_password: str, salt: bytes | None = None) -> tuple[str, str]:
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
    except (ValueError, TypeError):
        return False

DEFAULT_ADMIN_USERNAME = "admin"

def _resolve_username() -> str:
    """Username admin: dari env SIPEDAS_ADMIN_USERNAME, fallback ke 'admin'."""
    username = (os.environ.get("SIPEDAS_ADMIN_USERNAME") or "").strip()
    return username or DEFAULT_ADMIN_USERNAME

def _write_credentials(data: dict) -> None:
    with open(_AUTH_CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

def _get_or_create_admin_credentials() -> tuple[str, str, str]:
    """Mengambil (username, password_hash, salt) admin; inisialisasi bila belum ada.

    File kredensial yang dibuat sebelum fitur username belum punya kunci
    `username` — nilai default ditulis balik agar bisa diedit manual.
    """
    if os.path.exists(_AUTH_CONFIG_FILE):
        data = None
        try:
            with open(_AUTH_CONFIG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (OSError, json.JSONDecodeError) as e:
            logger.warning(f"Gagal membaca file kredensial admin: {e}")

        if isinstance(data, dict) and "password_hash" in data and "salt" in data:
            username = str(data.get("username") or "").strip()
            if not username:
                username = _resolve_username()
                try:
                    data["username"] = username
                    _write_credentials(data)
                except (OSError, TypeError) as e:
                    logger.warning(f"Gagal melengkapi username di file kredensial: {e}")
            return username, str(data["password_hash"]), str(data["salt"])

    # Wajib set env var SIPEDAS_ADMIN_PASSWORD di production
    default_plain = os.environ.get("SIPEDAS_ADMIN_PASSWORD")
    if not default_plain:
        raise RuntimeError(
            "SIPEDAS_ADMIN_PASSWORD belum di-set. "
            "Harap set environment variable ini sebelum menjalankan aplikasi."
        )
    p_hash, salt = _hash_password(default_plain)
    try:
        _write_credentials({
            "username": _resolve_username(),
            "password_hash": p_hash,
            "salt": salt,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
    except (OSError, TypeError) as e:
        print(f"Warning: Failed to save auth credentials: {e}")
    return _resolve_username(), p_hash, salt

def _update_admin_password(new_plain_password: str):
    p_hash, salt = _hash_password(new_plain_password)
    data: dict = {}
    if os.path.exists(_AUTH_CONFIG_FILE):
        try:
            with open(_AUTH_CONFIG_FILE, "r", encoding="utf-8") as f:
                loaded = json.load(f)
                if isinstance(loaded, dict):
                    data = loaded
        except (OSError, json.JSONDecodeError):
            data = {}
    # Pertahankan username yang sudah ada agar login tidak terkunci keluar.
    data["username"] = str(data.get("username") or "").strip() or _resolve_username()
    data["password_hash"] = p_hash
    data["salt"] = salt
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    _write_credentials(data)

def _clean_expired_sessions(db: Session):
    """Hapus sesi pengguna yang sudah kedaluwarsa."""
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=SESSION_MAX_AGE_HOURS)
    db.query(models.UserSession).filter(models.UserSession.last_active < cutoff).delete()
    db.commit()

def create_session(role: str = "admin", db: Session = None) -> str:
    sid = secrets.token_hex(32)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if db:
        session = models.UserSession(id=sid, role=role, created_at=now, last_active=now)
        db.add(session)
        db.commit()
    return sid

def destroy_session(session_id: str, db: Session = None):
    """Hapus sesi pengguna dari database."""
    if db and session_id:
        db.query(models.UserSession).filter(models.UserSession.id == session_id).delete()
        db.commit()

def require_admin(request: Request, db: Session = Depends(get_db)):
    """Periksa apakah pengguna adalah admin yang terautentikasi."""
    session_id = request.cookies.get("sipedas_session")
    if not session_id:
        raise HTTPException(status_code=401, detail="Unauthorized: silakan login sebagai admin.")
    sess = db.query(models.UserSession).filter(models.UserSession.id == session_id).first()
    if not sess:
        raise HTTPException(status_code=401, detail="Unauthorized: silakan login sebagai admin.")
    sess.last_active = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    return {"role": sess.role}

def log_activity(db: Session, action: str, target: str = "", detail: dict | None = None):
    """Catat aktivitas admin ke database."""
    log = models.ActivityLog(action=action, target=target, detail=detail or {})
    db.add(log)
    db.commit()

@router.post("/login")
def auth_login(payload: dict, request: Request, response: Response, db: Session = Depends(get_db)):
    """Proses login admin dengan rate limiting."""
    client_ip = _get_client_ip(request)
    now = _now()
    _prune_login_attempts(db, now)

    # 1. Periksa Lockout Rate Limiter
    attempt = _get_login_attempt(db, client_ip)
    if attempt and attempt.lock_until and attempt.lock_until > now:
        remaining_sec = int((attempt.lock_until - now).total_seconds())
        raise HTTPException(
            status_code=429,
            detail=f"Terlalu banyak percobaan login yang gagal. Akun dikunci sementara. Coba lagi dalam {remaining_sec} detik."
        )

    username = str(payload.get("username", "")).strip()
    password = str(payload.get("password", "")).strip()
    stored_username, stored_hash, stored_salt = _get_or_create_admin_credentials()

    # 2. Verifikasi username DAN password.
    #    Keduanya dihitung sebelum dievaluasi (tanpa short-circuit) supaya waktu
    #    respons sama walau username salah — mencegah user enumeration lewat timing.
    username_ok = bool(username) and secrets.compare_digest(
        username.encode("utf-8"), stored_username.encode("utf-8")
    )
    password_ok = _verify_password(password, stored_hash, stored_salt)

    if not (username_ok and password_ok):
        if attempt is None:
            attempt = models.LoginAttempt(ip=client_ip, failed_count=0, last_failed_at=now)
            db.add(attempt)
        attempt.failed_count = (attempt.failed_count or 0) + 1
        attempt.last_failed_at = now
        if attempt.failed_count >= MAX_FAILED_ATTEMPTS:
            attempt.lock_until = now + timedelta(seconds=LOCKOUT_DURATION_SECONDS)
            db.commit()
            raise HTTPException(
                status_code=429,
                detail=f"Login gagal {MAX_FAILED_ATTEMPTS} kali berturut-turut. Akses dikunci selama {LOCKOUT_DURATION_SECONDS // 60} menit demi keamanan."
            )
        sisa = MAX_FAILED_ATTEMPTS - attempt.failed_count
        db.commit()
        raise HTTPException(status_code=401, detail=f"Username atau password salah! Sisa percobaan: {sisa} kali.")

    # 3. Login Sukses: Reset Rate Limiter & Buat Sesi di database
    if attempt is not None:
        db.delete(attempt)
        db.commit()
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
    # Companion cookie non-HttpOnly untuk sinkronisasi instan frontend (zero-flicker SSR)
    response.set_cookie(
        key="sipedas_role",
        value="admin",
        httponly=False,
        secure=bool(os.environ.get("SIPEDAS_DOMAIN")),
        samesite="lax",
        max_age=SESSION_MAX_AGE_HOURS * 3600,
        path="/",
    )
    return {"role": "admin", "message": "Login admin berhasil.", "session_expires_in_hours": SESSION_MAX_AGE_HOURS}

@router.post("/logout")
def auth_logout(request: Request, response: Response, db: Session = Depends(get_db)):
    """Proses logout dan hapus sesi admin."""
    session_id = request.cookies.get("sipedas_session")
    if session_id:
        destroy_session(session_id, db)
    response.delete_cookie("sipedas_session", path="/")
    response.delete_cookie("sipedas_role", path="/")
    return {"role": "pegawai", "message": "Logout berhasil."}

@router.get("/me")
def auth_me(request: Request, db: Session = Depends(get_db)):
    """Ambil informasi role pengguna saat ini."""
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

    _, stored_hash, stored_salt = _get_or_create_admin_credentials()
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
    from datetime import datetime, timezone

    from main import _maintenance_cache, _update_maintenance_db

    mode = str(payload.get("mode", "")).strip()
    end_time = str(payload.get("end_time", "")).strip()

    if mode not in ("1", "0"):
        raise HTTPException(status_code=400, detail="mode harus '1' (aktif) atau '0' (nonaktif)")

    if mode == "1":
        if not end_time:
            raise HTTPException(status_code=400, detail="Waktu selesai wajib diisi saat mengaktifkan mode pemeliharaan.")
        try:
            iso_clean = end_time.strip()
            if iso_clean.endswith('Z'):
                iso_clean = iso_clean[:-1] + '+00:00'
            end_dt = datetime.fromisoformat(iso_clean)
            if end_dt.tzinfo is not None:
                now_dt = datetime.now(timezone.utc)
            else:
                now_dt = datetime.now(ZoneInfo("Asia/Jakarta")).replace(tzinfo=None)

            diff_seconds = (end_dt - now_dt).total_seconds()
            if diff_seconds < 60:
                raise HTTPException(
                    status_code=400,
                    detail="Waktu selesai pemeliharaan harus di masa depan (minimal 2 menit dari sekarang agar tidak langsung kedaluwarsa)."
                )
        except HTTPException:
            raise
        except (ValueError, TypeError) as e:
            raise HTTPException(status_code=400, detail=f"Format waktu selesai tidak valid: {e}")

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
