import logging
import os
import sys
import threading
import time
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy import inspect, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import models
from database import SessionLocal, engine, get_db

try:
    models.Base.metadata.create_all(bind=engine)
except SQLAlchemyError as e:
    print(f"[db] Peringatan create_all dilewati atau izin terbatas: {e}")

# ===== MIGRASI KOLOM BARU (idempoten) =====
def migrate_db_columns():
    """Tambahkan kolom baru ke tabel yang sudah ada tanpa menghapus data.
    Diperlukan karena create_all tidak menambah kolom ke tabel SQLite lama
    (headers/units/years di extracted_tables, sort_order di table_rows)."""
    inspector = inspect(engine)
    with engine.begin() as conn:
        existing_et = {c["name"] for c in inspector.get_columns("extracted_tables")}
        for col, coltype in [("headers", "JSON"), ("units", "JSON"), ("years", "JSON")]:
            if col not in existing_et:
                conn.execute(text(f"ALTER TABLE extracted_tables ADD COLUMN {col} {coltype}"))
        existing_tr = {c["name"] for c in inspector.get_columns("table_rows")}
        if "sort_order" not in existing_tr:
            conn.execute(text("ALTER TABLE table_rows ADD COLUMN sort_order INTEGER"))

try:
    migrate_db_columns()
    print("[migrate] Kolom database diverifikasi/diperbarui.")
except SQLAlchemyError as e:
    print(f"[migrate] Peringatan: gagal memigrasi kolom database: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle startup dan shutdown aplikasi."""
    try:
        _db = next(get_db())
        _clean_expired_sessions(_db)
        _db.close()
    except (SQLAlchemyError, RuntimeError) as _e:
        logger.warning(f"Gagal membersihkan sesi kedaluwarsa: {_e}")
    try:
        reset_stuck_extractions()
    except (SQLAlchemyError, RuntimeError) as _e:
        logger.warning(f"Gagal mereset status ekstraksi: {_e}")
    yield

app = FastAPI(title="BPS Extraction Dashboard API", lifespan=lifespan)

def reset_stuck_extractions():
    """Reset status ekstraksi yang terhenti menjadi ready."""
    db = next(get_db())
    try:
        stuck_docs = db.query(models.Document).filter(models.Document.status.like("extracting%")).all()
        for doc in stuck_docs:
            doc.status = "ready"
        db.commit()
        print(f"Reset {len(stuck_docs)} stuck document extraction status(es) to ready.")
    except SQLAlchemyError as e:
        print(f"Gagal me-reset status ekstraksi terhenti: {e}")

_PROD_DOMAIN = os.environ.get("SIPEDAS_DOMAIN", "")
if _PROD_DOMAIN:
    _CORS_ORIGINS = [f"https://{_PROD_DOMAIN}", f"http://{_PROD_DOMAIN}"]
else:
    _CORS_ORIGINS = ["http://127.0.0.1:8000", "http://localhost:8000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Kompresi GZip otomatis untuk respon JSON & berkas statis > 1KB (menghemat transfer 70-85%)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Caching cerdas untuk aset statis (CSS, JS, Fonts, Gambar)
@app.middleware("http")
async def add_cache_control_header(request: Request, call_next):
    """Tambahkan header cache-control untuk aset statis."""
    response = await call_next(request)
    if request.url.path.startswith("/static/"):
        response.headers["Cache-Control"] = "public, max-age=0, must-revalidate"
    return response

# =====================================================================
# MAINTENANCE MODE — database-backed via SystemConfig table
# Key: "maintenance_mode" = "1"|"0", "maintenance_end" = ISO timestamp
# Auto-disable saat maintenance_end lewat.
# Admin yang sudah login tetap bisa akses selama maintenance.
# =====================================================================

_maintenance_cache = {"active": False, "end": "", "ts": 0}
_CACHE_TTL = 5  # detik

def _is_maintenance():
    """Periksa apakah mode pemeliharaan aktif."""
    now = time.time()
    if now - _maintenance_cache["ts"] < _CACHE_TTL:
        return _maintenance_cache["active"]
    try:
        db = SessionLocal()
        row = db.query(models.SystemConfig).filter(models.SystemConfig.key == "maintenance_mode").first()
        val = row.value.strip() if row else "0"
        end_row = db.query(models.SystemConfig).filter(models.SystemConfig.key == "maintenance_end").first()
        end_val = end_row.value.strip() if end_row else ""
        db.close()
        # Auto-disable jika maintenance_end sudah lewat
        if val == "1" and end_val:
            from datetime import datetime, timezone
            from zoneinfo import ZoneInfo
            try:
                iso_clean = end_val.strip()
                if iso_clean.endswith('Z'):
                    iso_clean = iso_clean[:-1] + '+00:00'
                end_dt = datetime.fromisoformat(iso_clean)
                if end_dt.tzinfo is not None:
                    now_dt = datetime.now(timezone.utc)
                else:
                    now_dt = datetime.now(ZoneInfo("Asia/Jakarta")).replace(tzinfo=None)

                if now_dt >= end_dt:
                    val = "0"
                    _update_maintenance_db("0", "", log_reason=f"Waktu selesai pemeliharaan telah tercapai ({end_val})")
            except (ValueError, TypeError) as e:
                print(f"[MAINTENANCE] Gagal mem-parse waktu pemeliharaan '{end_val}': {e}")
        _maintenance_cache["active"] = (val == "1")
        _maintenance_cache["end"] = end_val
        _maintenance_cache["ts"] = now
    except (SQLAlchemyError, ValueError, TypeError):
        logger.warning("Gagal membaca status pemeliharaan dari database")
    return _maintenance_cache["active"]

def _maintenance_end():
    """Ambil waktu selesai pemeliharaan dari cache."""
    if _maintenance_cache["ts"] and (time.time() - _maintenance_cache["ts"] < _CACHE_TTL):
        return _maintenance_cache["end"]
    _is_maintenance()  # refresh cache
    return _maintenance_cache["end"]

def _update_maintenance_db(mode, end_time="", log_reason=""):
    """Perbarui status pemeliharaan di database."""
    try:
        db = SessionLocal()
        for k, v in [("maintenance_mode", mode), ("maintenance_end", end_time)]:
            row = db.query(models.SystemConfig).filter(models.SystemConfig.key == k).first()
            if row:
                row.value = v
            else:
                db.add(models.SystemConfig(key=k, value=v))
        if log_reason:
            log = models.ActivityLog(
                action="toggle_maintenance",
                target="Mode: AUTO_OFF",
                detail={"reason": log_reason, "mode": mode}
            )
            db.add(log)
        db.commit()
        db.close()
    except SQLAlchemyError as e:
        print(f"[MAINTENANCE] Gagal mengupdate konfigurasi pemeliharaan: {e}")
    _maintenance_cache["ts"] = 0

@app.middleware("http")
async def maintenance_middleware(request: Request, call_next):
    """Blokir akses non-admin saat mode pemeliharaan aktif."""
    if _is_maintenance():
        path = request.url.path
        # Static files tetap jalan
        if path.startswith("/static/") or path == "/favicon.ico":
            return await call_next(request)

        # Login page & login API harus tetap bisa diakses
        # Supaya admin bisa login → lalu bypass maintenance
        if path == "/login" or path.startswith("/api/auth/login"):
            return await call_next(request)

        # Force maintenance dari cross-tab sync: skip admin bypass
        force_maintenance = '_force_maintenance=1' in str(request.url.query)

        # Cek apakah user adalah admin yang sudah login (skip jika force)
        if not force_maintenance:
            session_id = request.cookies.get("sipedas_session")
            if session_id:
                db = next(get_db())
                try:
                    sess = db.query(models.UserSession).filter(
                        models.UserSession.id == session_id,
                        models.UserSession.role == "admin"
                    ).first()
                    if sess:
                        return await call_next(request)
                finally:
                    db.close()

        # Non-admin → maintenance page
        if path.startswith("/api/"):
            return JSONResponse(status_code=503, content={"detail": "Sistem sedang dalam pemeliharaan. Silakan coba lagi nanti."})
        return templates.TemplateResponse(
            request=request, name="maintenance.html", status_code=503,
            context={"maintenance_end": _maintenance_end()}
        )
    return await call_next(request)

# =====================================================================
# GLOBAL ERROR HANDLERS — 404, 500, dan error tak terduga
# =====================================================================
@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    """Tangani error 404 not found."""
    path = request.url.path
    if path.startswith("/api/"):
        return JSONResponse(status_code=404, content={"detail": "Endpoint tidak ditemukan."})
    return templates.TemplateResponse(request=request, name="404.html", status_code=404)

@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):
    """Tangani error 500 internal server error."""
    path = request.url.path
    if path.startswith("/api/"):
        return JSONResponse(status_code=500, content={"detail": "Terjadi kesalahan internal server. Silakan coba lagi."})
    return templates.TemplateResponse(request=request, name="500.html", status_code=500)

@app.exception_handler(502)
async def bad_gateway_handler(request: Request, exc):
    """Tangani error 502 bad gateway."""
    path = request.url.path
    if path.startswith("/api/"):
        return JSONResponse(status_code=502, content={"detail": "Layanan sedang memuat ulang. Silakan coba lagi."})
    return templates.TemplateResponse(request=request, name="502.html", status_code=502)

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc):
    """Tangani semua exception yang tidak tertangani."""
    print(f"[ERROR] Unhandled exception at {request.url.path}: {exc}")
    path = request.url.path
    if path.startswith("/api/"):
        return JSONResponse(status_code=500, content={"detail": "Terjadi kesalahan tidak terduga. Silakan coba lagi."})
    return templates.TemplateResponse(request=request, name="500.html", status_code=500)

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_FRONTEND_DIR = os.path.abspath(os.path.join(_BASE_DIR, "..", "frontend"))

# Professional Directory Separation: Mount from frontend/ if present, otherwise fallback to backend/
STATIC_DIR = os.path.join(_FRONTEND_DIR, "static") if os.path.exists(os.path.join(_FRONTEND_DIR, "static")) else os.path.join(_BASE_DIR, "static")
TEMPLATES_DIR = os.path.join(_FRONTEND_DIR, "templates") if os.path.exists(os.path.join(_FRONTEND_DIR, "templates")) else os.path.join(_BASE_DIR, "templates")

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
templates = Jinja2Templates(directory=TEMPLATES_DIR)


# =====================================================================
# DIREKTORI PENYIMPANAN
# CSV hasil ekstraksi dan PDF upload disimpan di luar folder project
# agar tidak mengotori direktori kode sumber.
# Lokasi: ~/BPS_Data/ (Linux/Mac) atau C:\Users\[user]\BPS_Data\ (Windows)
# =====================================================================
_BPS_DATA_ROOT = os.path.join(os.path.expanduser("~"), "BPS_Data")
UPLOAD_DIR = os.path.join(_BPS_DATA_ROOT, "uploads")
EXTRACT_DIR = os.path.join(_BPS_DATA_ROOT, "hasil_ekstraksi_web")

# Backup database .sql disimpan di folder backups/ dalam project (di luar hasil_ekstraksi_web)
BACKUP_DIR = os.path.abspath(os.path.join(_BASE_DIR, "..", "backups"))

try:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    os.makedirs(EXTRACT_DIR, exist_ok=True)
    os.makedirs(BACKUP_DIR, exist_ok=True)
except OSError as _e:
    logger.warning(f"Gagal membuat direktori penyimpanan: {_e}")

@app.get("/")
def read_root(request: Request, db: Session = Depends(get_db)):
    """Halaman utama dashboard berdasarkan role pengguna."""
    role = "pegawai"
    session_id = request.cookies.get("sipedas_session")
    if session_id:
        sess = db.query(models.UserSession).filter(models.UserSession.id == session_id).first()
        if sess and sess.role == "admin":
            role = "admin"
    is_sidebar_collapsed = request.cookies.get("sipedas_sidebar_collapsed") == "true"
    response = templates.TemplateResponse(
        request=request,
        name="index.html",
        context={"initial_role": role, "initial_sidebar_collapsed": is_sidebar_collapsed}
    )
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    return response

@app.get("/login")
def login_page(request: Request, db: Session = Depends(get_db)):
    """Tampilkan halaman login admin."""
    session_id = request.cookies.get("sipedas_session")
    if session_id:
        sess = db.query(models.UserSession).filter(models.UserSession.id == session_id).first()
        if sess and sess.role == "admin":
            return RedirectResponse(url="/", status_code=303)
    response = templates.TemplateResponse(
        request=request,
        name="login.html",
        context={}
    )
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    return response

@app.get("/favicon.ico", include_in_schema=False)
def get_favicon():
    """Sajikan file favicon aplikasi."""
    favicon_path = os.path.join(STATIC_DIR, "logo_sipedas.png")
    if os.path.exists(favicon_path):
        return FileResponse(favicon_path, media_type="image/png")
    return Response(status_code=204)

@app.get("/robots.txt", include_in_schema=False)
def get_robots_txt():
    """Sajikan file robots.txt untuk crawler."""
    content = "User-agent: *\nDisallow: /api/\nAllow: /\n"
    return Response(content=content, media_type="text/plain")

@app.get("/502", include_in_schema=False)
def preview_502_page(request: Request):
    """Endpoint untuk pengujian/pratinjau tampilan 502 Bad Gateway (status 200 agar tidak di-intercept Nginx default)."""
    return templates.TemplateResponse(request=request, name="502.html", status_code=200)

# In-memory TTL cache for dashboard stats (5 minutes)
_STATS_CACHE = None
_STATS_CACHE_TIME = 0
_STATS_TTL = 300  # 5 minutes
_STATS_CACHE_LOCK = threading.Lock()

def invalidate_stats_cache():
    """Bersihkan cache statistik dashboard."""
    global _STATS_CACHE, _STATS_CACHE_TIME
    with _STATS_CACHE_LOCK:
        _STATS_CACHE = None
        _STATS_CACHE_TIME = 0

# =====================================================================
# ROUTERS MOUNTING
# =====================================================================
from routers.admin import router as admin_router
from routers.anomaly import router as anomaly_router
from routers.auth import _clean_expired_sessions
from routers.auth import router as auth_router
from routers.documents import router as documents_router
from routers.import_excel import router as import_excel_router
from routers.master_data import router as master_data_router
from routers.stats import router as stats_router
from routers.tables import router as tables_router
from routers.timeseries import router as timeseries_router

app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(stats_router)
app.include_router(tables_router)
app.include_router(documents_router)
app.include_router(timeseries_router)
app.include_router(anomaly_router)
app.include_router(master_data_router)
app.include_router(import_excel_router)

# =====================================================================
# CATCH-ALL ROUTE — SPA fallback untuk URL yang tidak dikenali
# =====================================================================
@app.get("/{path:path}")
def catch_all(request: Request, path: str):
    """Tangani semua URL yang tidak dikenali sebagai 404."""
    if path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Endpoint tidak ditemukan.")
    return templates.TemplateResponse(request=request, name="404.html", status_code=404)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
