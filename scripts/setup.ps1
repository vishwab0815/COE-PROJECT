# ========================================================
#   Attendance AI - One-time Setup
#   Creates backend\venv (Python 3.12), installs CUDA PyTorch + deps,
#   installs frontend packages. Re-running is safe.
# ========================================================
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$venv = Join-Path $root "backend\venv"
$py = Join-Path $venv "Scripts\python.exe"

if (-not (Test-Path $py)) {
    Write-Host "[1/5] Creating virtualenv (Python 3.12)..." -ForegroundColor Yellow
    py -3.12 -m venv $venv
}

Write-Host "[2/5] Installing PyTorch (CUDA 12.8)..." -ForegroundColor Yellow
& $py -m pip install --upgrade pip
& $py -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128

Write-Host "[3/5] Installing backend requirements..." -ForegroundColor Yellow
& $py -m pip install -r (Join-Path $root "requirements.txt")
& $py -m pip install facenet-pytorch==2.6.0 --no-deps

Write-Host "[4/5] Installing frontend packages..." -ForegroundColor Yellow
Push-Location (Join-Path $root "frontend"); npm ci; Pop-Location

# Portable MongoDB inside the project: only mongod.exe is extracted, nothing installed system-wide
$mongod = Join-Path $root "mongodb\bin\mongod.exe"
if (-not (Test-Path $mongod)) {
    Write-Host "[5/5] Downloading portable MongoDB 7.0.45..." -ForegroundColor Yellow
    $url = "https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-7.0.45.zip"
    $zip = Join-Path $env:TEMP "mongodb-7.0.45.zip"
    Invoke-WebRequest $url -OutFile $zip
    $sha = (Invoke-WebRequest "$url.sha256").Content
    if ($sha -is [byte[]]) { $sha = [Text.Encoding]::ASCII.GetString($sha) }
    if ((Get-FileHash $zip -Algorithm SHA256).Hash -ne $sha.Split(" ")[0].Trim()) { throw "MongoDB download checksum mismatch" }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::OpenRead($zip)
    try {
        New-Item -ItemType Directory -Force (Split-Path $mongod) | Out-Null
        $entry = $archive.Entries | Where-Object { $_.FullName -like "*/bin/mongod.exe" }
        [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $mongod, $true)
    } finally { $archive.Dispose(); Remove-Item $zip }
} else {
    Write-Host "[5/5] MongoDB already present" -ForegroundColor DarkGray
}

if (-not (Test-Path (Join-Path $root ".env"))) {
    Copy-Item (Join-Path $root ".env.example") (Join-Path $root ".env")
    Write-Host "Created .env from .env.example - set ADMIN_PIN and SECRET_KEY!" -ForegroundColor Magenta
}
Write-Host "Setup complete. Run scripts\start_prod.ps1" -ForegroundColor Green
