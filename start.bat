@echo off
echo Menghentikan server lama yang mungkin masih berjalan di port 8000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000') do taskkill /F /PID %%a 2>nul

echo.
echo Mengaktifkan Virtual Environment dan Memulai Server...
cd backend
call venv\Scripts\activate

REM === MAINTENANCE MODE ===
REM Uncomment baris di bawah untuk aktifkan maintenance mode:
REM set SIPEDAS_MAINTENANCE=1

python run_server.py
pause
