@echo off
echo Menghentikan server lama yang mungkin masih berjalan di port 8000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000') do taskkill /F /PID %%a 2>nul

echo.
echo ========================================
echo   SIPEDAS - Pilih Mode:
echo ========================================
echo   1. Normal Mode (Server Biasa)
echo   2. Maintenance Mode
echo   3. Nonaktifkan Maintenance
echo   4. Keluar
echo ========================================
set /p "pilihan=Pilihan [1/2/3/4]: "

if "%pilihan%"=="1" goto NORMAL
if "%pilihan%"=="2" goto MAINTENANCE
if "%pilihan%"=="3" goto STOP_MAINT
if "%pilihan%"=="4" goto EXIT

echo Pilihan tidak valid!
pause
goto EXIT

:NORMAL
echo.
echo Memulai server dalam mode normal...
cd backend
call venv\Scripts\activate
python run_server.py
pause
goto EXIT

:MAINTENANCE
echo.
set /p "end_time=Waktu selesai maintenance (ISO: 2026-09-05 08:00): "
echo.
echo Mengaktifkan maintenance mode...
cd backend
call venv\Scripts\activate
python -c "from database import SessionLocal, engine; from models import SystemConfig, Base; Base.metadata.create_all(bind=engine); db=SessionLocal(); from datetime import datetime; k1=db.query(SystemConfig).filter(SystemConfig.key=='maintenance_mode').first(); k1.value='1' if k1 else db.add(SystemConfig(key='maintenance_mode',value='1')); k2=db.query(SystemConfig).filter(SystemConfig.key=='maintenance_end').first(); k2.value='%end_time%' if k2 else db.add(SystemConfig(key='maintenance_end',value='%end_time%')); db.commit(); db.close(); print('Maintenance mode AKTIF')"
echo.
echo Memulai server...
python run_server.py
pause
goto EXIT

:STOP_MAINT
echo.
echo Menonaktifkan maintenance mode...
cd backend
call venv\Scripts\activate
python -c "from database import SessionLocal, engine; from models import SystemConfig, Base; Base.metadata.create_all(bind=engine); db=SessionLocal(); k1=db.query(SystemConfig).filter(SystemConfig.key=='maintenance_mode').first(); k1.value='0' if k1 else db.add(SystemConfig(key='maintenance_mode',value='0')); k2=db.query(SystemConfig).filter(SystemConfig.key=='maintenance_end').first(); k2.value='' if k2 else db.add(SystemConfig(key='maintenance_end',value='')); db.commit(); db.close(); print('Maintenance mode NONAKTIF')"
echo.
echo Maintenance mode sudah nonaktif. Server akan start normal.
cd backend
python run_server.py
pause
goto EXIT

:EXIT
exit /b
