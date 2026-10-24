# ========================================================
#   Attendance AI - Start project-local MongoDB
#   mongodb\bin\mongod.exe, data in data\db (localhost only).
#   Safe to run repeatedly: does nothing if already running.
# ========================================================
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$mongod = Join-Path $root "mongodb\bin\mongod.exe"
$dbPath = Join-Path $root "data\db"
$log = Join-Path $root "data\mongod.log"

if (-not (Test-Path $mongod)) { throw "mongodb\bin\mongod.exe not found - run scripts\setup.ps1 first" }

function Test-MongoUp { [bool](Get-NetTCPConnection -LocalPort 27017 -State Listen -ErrorAction SilentlyContinue) }

if (Test-MongoUp) { Write-Host "MongoDB already running on 127.0.0.1:27017" -ForegroundColor DarkGray; return }

New-Item -ItemType Directory -Force $dbPath | Out-Null
# 256 MB cache keeps MongoDB light on low-memory laptops (plenty for this dataset)
Start-Process -FilePath $mongod -WindowStyle Hidden -ArgumentList @(
    "--dbpath", "`"$dbPath`"", "--bind_ip", "127.0.0.1", "--port", "27017",
    "--wiredTigerCacheSizeGB", "0.25", "--logpath", "`"$log`"", "--logappend"
)

for ($i = 0; $i -lt 30; $i++) {
    if (Test-MongoUp) { Write-Host "MongoDB started (data: data\db)" -ForegroundColor Green; return }
    Start-Sleep -Seconds 1
}
throw "MongoDB did not start - see data\mongod.log"
