@echo off
color 0B
echo ========================================================
echo    Attendance AI - One-Click Launcher
echo ========================================================
echo.

echo [1/2] Starting FastAPI Backend (Port 8000)...
start "Attendance AI - Backend" cmd /k "cd ..\backend && title Backend Server && set PY_EXEC=python&& if exist ..\..\.cuda\Scripts\python.exe (set PY_EXEC=..\..\.cuda\Scripts\python.exe) else if exist venv\Scripts\python.exe (set PY_EXEC=venv\Scripts\python.exe) else if exist .venv\Scripts\python.exe (set PY_EXEC=.venv\Scripts\python.exe)&& echo Using Python: %PY_EXEC% && call %PY_EXEC% -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

echo [2/2] Starting React Frontend (Port 5173)...
start "Attendance AI - Frontend" cmd /k "cd ..\frontend && title Frontend Server && npm install && npm run dev"

echo.
echo All services are launching in new windows!
echo You can now close this launcher window.
echo ========================================================
pause
