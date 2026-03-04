Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   Attendance AI - PowerShell Launcher" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/2] Starting FastAPI Backend (Port 8000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd ..\backend; `$host.ui.RawUI.WindowTitle = 'Backend Server'; & '..\..\.cuda\Scripts\python.exe' -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

Write-Host "[2/2] Starting React Frontend (Port 5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd ..\frontend; `$host.ui.RawUI.WindowTitle = 'Frontend Server'; npm run dev"

Write-Host ""
Write-Host "All services are launching in new windows!" -ForegroundColor Green
Write-Host "You can now close this launcher window." -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan
