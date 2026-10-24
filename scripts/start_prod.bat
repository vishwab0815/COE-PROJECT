@echo off
REM Attendance AI - Production Launcher (wrapper for start_prod.ps1)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_prod.ps1" %*
pause
