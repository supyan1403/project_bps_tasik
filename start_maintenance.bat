@echo off
setlocal
set "SIPEDAS_DIR=%~dp0backend"

echo ========================================
echo   SIPEDAS - Aktifkan Maintenance Mode
echo ========================================
set /p "end_time=Target selesai (format: 2026-10-05 08:00): "
if not defined end_time (
    echo Waktu selesai tidak boleh kosong.
    pause
    exit /b 1
)

cd /d "%SIPEDAS_DIR%"
call venv\Scripts\activate

echo.
echo Mengaktifkan maintenance mode sampai %end_time% ...
python -c "from database import SessionLocal, engine; from models import SystemConfig, Base; Base.metadata.create_all(bind=engine); db=SessionLocal(); k1=db.query(SystemConfig).filter(SystemConfig.key=='maintenance_mode').first(); k1.value='1' if k1 else db.add(SystemConfig(key='maintenance_mode',value='1')); k2=db.query(SystemConfig).filter(SystemConfig.key=='maintenance_end').first(); k2.value='%end_time%' if k2 else db.add(SystemConfig(key='maintenance_end',value='%end_time%')); db.commit(); db.close(); print('Maintenance mode AKTIF sampai %end_time%')"

echo.
echo Menjalankan server...
python run_server.py
pause
endlocal
