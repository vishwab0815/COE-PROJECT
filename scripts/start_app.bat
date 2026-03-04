@echo off
color 0B
echo ========================================================
echo    Attendance AI - One-Click Launcher
echo ========================================================
echo.

echo [1/2] Starting FastAPI Backend (Port 8000)...
start "Attendance AI - Backend" cmd /k "cd ..\backend && title Backend Server && ..\..\.cuda\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

echo [2/2] Starting React Frontend (Port 5173)...
start "Attendance AI - Frontend" cmd /k "cd ..\frontend && title Frontend Server && npm run dev"

echo.
echo All services are launching in new windows!
echo You can now close this launcher window.
echo ========================================================
pause
