import os
import glob
import subprocess
from datetime import datetime
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from sqlalchemy.orm import Session
from sqlalchemy.engine import make_url

import models
from database import engine, get_db
from routers.auth import require_admin, log_activity

router = APIRouter(prefix="/api/admin", tags=["Admin & Backups"])

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKUP_DIR = os.path.abspath(os.path.join(_BASE_DIR, "..", "backups"))
if not os.path.exists(os.path.dirname(BACKUP_DIR)):
    BACKUP_DIR = "/tmp/backups" if os.environ.get("VERCEL") else BACKUP_DIR

try:
    os.makedirs(BACKUP_DIR, exist_ok=True)
except Exception:
    pass

def cleanup_old_backups(keep: int = 10):
    """Hapus backup lama, sisakan N terbaru berdasarkan waktu modifikasi."""
    files = sorted(
        glob.glob(os.path.join(BACKUP_DIR, "*.sql")),
        key=os.path.getmtime,
        reverse=True
    )
    for f in files[keep:]:
        try:
            os.remove(f)
        except Exception:
            pass

def backup_database() -> str:
    """Buat dump .sql seluruh database ke BACKUP_DIR, kembali nama file backup."""
    url = make_url(engine.url)
    db_name = url.database
    user = url.username or "root"
    password = url.password or ""

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_name = f"bps_{db_name}_{ts}.sql"
    backup_path = os.path.join(BACKUP_DIR, backup_name)

    mysqldump_candidates = [
        r"D:\xampp\mysql\bin\mysqldump.exe",
        r"C:\xampp\mysql\bin\mysqldump.exe",
        r"D:\laragon\bin\mysql\mysql-8.0.30-winx64\bin\mysqldump.exe",
        "mysqldump",
    ]

    import shutil
    for _pattern in [
        r"C:\Program Files\MySQL\MySQL Server *\bin\mysqldump.exe",
        r"C:\Program Files (x86)\MySQL\MySQL Server *\bin\mysqldump.exe",
    ]:
        mysqldump_candidates.extend(glob.glob(_pattern))

    mysqldump = next((c for c in mysqldump_candidates if shutil.which(c) or os.path.exists(c)), None)
    if mysqldump is None:
        raise RuntimeError(
            "mysqldump tidak ditemukan. Install MySQL/XAMPP, atau tambahkan mysqldump ke PATH. "
            f"Dicari di: {mysqldump_candidates}"
        )

    cmd = [mysqldump, "-u", user, "--skip-comments", db_name]
    if password:
        cmd.insert(2, f"-p{password}")

    with open(backup_path, "w", encoding="utf-8", errors="replace") as f:
        result = subprocess.run(cmd, stdout=f, stderr=subprocess.PIPE, check=False)

    fsize = os.path.getsize(backup_path) if os.path.exists(backup_path) else -1
    if os.path.exists(backup_path) and fsize > 0:
        cleanup_old_backups()
        return backup_path
    raise RuntimeError(f"Backup gagal: file .sql kosong/tidak terbentuk (size={fsize}, rc={result.returncode}, stderr={result.stderr.decode('utf-8', errors='replace')[:200]})")

def restore_database(backup_path: str) -> dict:
    """Restore database dari file backup .sql."""
    url = make_url(engine.url)
    db_name = url.database
    user = url.username or "root"
    password = url.password or ""
    host = url.host or "127.0.0.1"
    port = str(url.port or 3306)

    if not os.path.exists(backup_path):
        raise FileNotFoundError(f"File backup tidak ditemukan: {backup_path}")

    # 1. Emergency safety auto-backup sebelum proses restore
    pre_backup_path = None
    try:
        pre_backup_path = backup_database()
    except Exception as eb:
        print(f"Warning: gagal membuat pre-restore auto backup: {eb}")

    # 2. Cari executable mysql CLI
    mysql_candidates = [
        os.path.join("D:", "xampp", "mysql", "bin", "mysql.exe"),
        "mysql",
    ]
    import shutil
    mysql_bin = next((c for c in mysql_candidates if shutil.which(c) or os.path.exists(c)), "mysql")

    cmd = [mysql_bin, "-h", host, "-P", port, "-u", user, db_name]
    if password:
        cmd.insert(5, f"-p{password}")

    with open(backup_path, "r", encoding="utf-8", errors="replace") as f:
        proc = subprocess.run(cmd, stdin=f, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

    if proc.returncode != 0:
        raise RuntimeError(f"Gagal me-restore database: {proc.stderr}")

    return {
        "message": "Database berhasil dipulihkan (restore)!",
        "restored_file": os.path.basename(backup_path),
        "pre_backup": os.path.basename(pre_backup_path) if pre_backup_path else None
    }

class RestoreRequest(BaseModel):
    filename: str

@router.get("/activity-logs")
def get_activity_logs(page: int = 1, limit: int = 20, db: Session = Depends(get_db), admin: dict = Depends(require_admin)):
    """Daftar riwayat aktivitas admin terbaru."""
    try:
        total = db.query(models.ActivityLog).count()
        logs = (
            db.query(models.ActivityLog)
            .order_by(models.ActivityLog.timestamp.desc())
            .offset((page - 1) * limit)
            .limit(limit)
            .all()
        )
        return {
            "logs": [
                {
                    "id": l.id,
                    "timestamp": l.timestamp.strftime("%Y-%m-%d %H:%M:%S") if l.timestamp else "",
                    "action": l.action,
                    "target": l.target or "",
                    "detail": l.detail or {}
                }
                for l in logs
            ],
            "total": total,
            "page": page,
            "limit": limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/backup")
def create_backup(admin: dict = Depends(require_admin), db: Session = Depends(get_db)):
    """Backup manual seluruh database ke folder backups/."""
    try:
        path = backup_database()
        file_size = os.path.getsize(path) if os.path.exists(path) else 0
        log_activity(db, "backup", os.path.basename(path), {"size": file_size})
        return {
            "message": "Backup berhasil dibuat",
            "file": os.path.basename(path),
            "path": path
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backup gagal: {str(e)}")

@router.get("/backups")
def list_backups(admin: dict = Depends(require_admin)):
    """Daftar file backup .sql yang ada."""
    try:
        files = []
        if os.path.isdir(BACKUP_DIR):
            for fn in sorted(os.listdir(BACKUP_DIR), reverse=True):
                if fn.lower().endswith(".sql"):
                    fp = os.path.join(BACKUP_DIR, fn)
                    files.append({
                        "file": fn,
                        "size": os.path.getsize(fp),
                        "modified": datetime.fromtimestamp(os.path.getmtime(fp)).strftime("%Y-%m-%d %H:%M:%S")
                    })
        return {"backups": files, "dir": BACKUP_DIR}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/restore")
def restore_existing_backup(req: RestoreRequest, admin: dict = Depends(require_admin), db: Session = Depends(get_db)):
    """Restore database dari file backup .sql yang ada di folder backups/."""
    try:
        safe_fn = os.path.basename(req.filename)
        if not safe_fn.lower().endswith(".sql"):
            raise HTTPException(status_code=400, detail="Hanya file .sql yang diperbolehkan.")
        
        target_path = os.path.join(BACKUP_DIR, safe_fn)
        if not os.path.exists(target_path):
            raise HTTPException(status_code=404, detail=f"File {safe_fn} tidak ditemukan.")
            
        res = restore_database(target_path)
        log_activity(db, "restore", safe_fn, {"restored_from": safe_fn})
        return res
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Restore gagal: {str(e)}")

@router.post("/restore-upload")
async def restore_uploaded_backup(file: UploadFile = File(...), admin: dict = Depends(require_admin)):
    """Upload file .sql baru dan langsung restore ke database."""
    try:
        if not file.filename.lower().endswith(".sql"):
            raise HTTPException(status_code=400, detail="File harus berekstensi .sql.")
        
        safe_fn = f"upload_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{os.path.basename(file.filename)}"
        save_path = os.path.join(BACKUP_DIR, safe_fn)
        
        content = await file.read()
        with open(save_path, "wb") as f:
            f.write(content)
            
        res = restore_database(save_path)
        return res
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Restore gagal: {str(e)}")

@router.delete("/backups/{filename}")
def delete_backup_file(filename: str, admin: dict = Depends(require_admin)):
    """Hapus file backup .sql dari folder backups/."""
    try:
        safe_fn = os.path.basename(filename)
        target_path = os.path.join(BACKUP_DIR, safe_fn)
        if os.path.exists(target_path) and os.path.isfile(target_path):
            os.remove(target_path)
            return {"message": f"File {safe_fn} berhasil dihapus"}
        raise HTTPException(status_code=404, detail="File tidak ditemukan")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# =====================================================================
# SYSTEM INFO
# =====================================================================

import time as _time
import platform

_server_start_time = _time.time()

_app_version = "2.0.0"

@router.get("/system-info")
def get_system_info(admin: dict = Depends(require_admin)):
    """Info sistem: versi, DB stats, uptime, dll."""
    from database import engine
    from sqlalchemy import text

    info = {
        "version": _app_version,
        "total_tables": 0,
        "total_rows": 0,
        "total_docs": 0,
        "db_size": "-",
        "uptime": "-",
        "python_version": platform.python_version(),
        "fastapi_version": "-",
    }

    try:
        db = next(get_db())
        info["total_tables"] = db.query(models.ExtractedTable).count()
        info["total_rows"] = db.query(models.TableRow).count()
        info["total_docs"] = db.query(models.Document).count()

        # DB size (MySQL)
        try:
            result = db.execute(text(
                "SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb "
                "FROM information_schema.tables WHERE table_schema = DATABASE()"
            )).fetchone()
            if result and result[0]:
                info["db_size"] = f"{result[0]} MB"
        except Exception:
            info["db_size"] = "N/A"

        db.close()
    except Exception:
        pass

    # Uptime
    uptime_sec = int(_time.time() - _server_start_time)
    days = uptime_sec // 86400
    hours = (uptime_sec % 86400) // 3600
    mins = (uptime_sec % 3600) // 60
    if days > 0:
        info["uptime"] = f"{days} hari {hours} jam {mins} menit"
    elif hours > 0:
        info["uptime"] = f"{hours} jam {mins} menit"
    else:
        info["uptime"] = f"{mins} menit"

    # FastAPI version
    try:
        import fastapi
        info["fastapi_version"] = fastapi.__version__
    except Exception:
        pass

    return info
