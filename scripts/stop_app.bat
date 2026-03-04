@echo off
color 0C
echo ========================================================
echo    Attendance AI - Stop Servers
echo ========================================================
echo.

echo [1/2] Closing Terminal Windows...
taskkill /F /FI "WindowTitle eq Backend Server*" /T >nul 2>&1
taskkill /F /FI "WindowTitle eq Frontend Server*" /T >nul 2>&1
taskkill /F /FI "WindowTitle eq Attendance AI - Backend*" /T >nul 2>&1
taskkill /F /FI "WindowTitle eq Attendance AI - Frontend*" /T >nul 2>&1

echo [2/2] Force-killing any lingering processes on ports 8000 and 5173...
FOR /F "tokens=5" %%T IN ('netstat -a -n -o ^| findstr :8000') DO (
    taskkill /F /PID %%T >nul 2>&1
)
FOR /F "tokens=5" %%T IN ('netstat -a -n -o ^| findstr :5173') DO (
    taskkill /F /PID %%T >nul 2>&1
)

echo.
echo All Attendance AI services stopped successfully!
echo ========================================================
timeout /t 3
