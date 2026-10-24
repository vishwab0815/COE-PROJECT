# ========================================================
#   Attendance AI - Production Launcher
#   Local MongoDB (mongodb\, data in data\db) + built React app served by FastAPI on :8000
# ========================================================
param([switch]$Rebuild)
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$py = Join-Path $root "backend\venv\Scripts\python.exe"

if (-not (Test-Path $py)) { throw "backend\venv not found - run scripts\setup.ps1 first" }

Write-Host "[1/3] Starting MongoDB..." -ForegroundColor Yellow
& (Join-Path $PSScriptRoot "start_mongo.ps1")

$dist = Join-Path $root "frontend\dist\index.html"
if ($Rebuild -or -not (Test-Path $dist)) {
    Write-Host "[2/3] Building frontend..." -ForegroundColor Yellow
    Push-Location (Join-Path $root "frontend"); npm run build; Pop-Location
} else {
    Write-Host "[2/3] Frontend already built (use -Rebuild to rebuild)" -ForegroundColor DarkGray
}

Write-Host "[3/3] Starting server on http://localhost:8000 ..." -ForegroundColor Yellow
# Single worker: camera, tracker state and FAISS index are in-process singletons.
Push-Location (Join-Path $root "backend")
try {
    & $py -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 --proxy-headers --log-level info
} finally {
    Pop-Location
}
