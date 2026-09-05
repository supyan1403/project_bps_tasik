@echo off
set SIPEDAS_MAINTENANCE=1
set SIPEDAS_MAINTENANCE_END=2026-09-05T08:00:00
cd /d D:\Kuliah\KP\project_bps_tasik\backend
call venv\Scripts\activate
python run_server.py
pause
