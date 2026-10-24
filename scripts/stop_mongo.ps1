# ========================================================
#   Attendance AI - Cleanly stop project-local MongoDB
# ========================================================
$root = Split-Path $PSScriptRoot -Parent
$py = Join-Path $root "backend\venv\Scripts\python.exe"

if (-not (Get-NetTCPConnection -LocalPort 27017 -State Listen -ErrorAction SilentlyContinue)) {
    Write-Host "MongoDB is not running" -ForegroundColor DarkGray; return
}
# Clean shutdown (flushes data) via the admin 'shutdown' command; the connection
# dropping mid-command is the expected outcome.
& $py -c "from pymongo import MongoClient`ntry: MongoClient('mongodb://127.0.0.1:27017', serverSelectionTimeoutMS=3000).admin.command('shutdown')`nexcept Exception: pass"
Write-Host "MongoDB stopped" -ForegroundColor Green
