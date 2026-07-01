$ErrorActionPreference = "Stop"

$EchoDir  = Split-Path -Parent $PSScriptRoot
$VenvDir  = Join-Path $EchoDir ".venv"
$Python   = Join-Path $VenvDir "Scripts\python.exe"
$BuildDir = Join-Path $EchoDir "build"
$Spec     = Join-Path $EchoDir "scripts\echo-server.spec"

function Log($m)  { Write-Host "  [ok] $m"   -ForegroundColor Green }
function Info($m) { Write-Host "  [~ ] $m"   -ForegroundColor Yellow }
function Fail($m) { Write-Host "  [x ] $m"   -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "       Echo Server Freezer        " -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $Python)) { Fail "Virtual environment not found. Run setup first: npm run setup" }

Info "Ensuring PyInstaller is installed..."
& $Python -m pip install --quiet --upgrade pyinstaller
if ($LASTEXITCODE -ne 0) { Fail "Failed to install PyInstaller" }
Log "PyInstaller ready"

Info "Freezing server.py (GPU if CUDA libs present, else CPU)..."
Push-Location $EchoDir
& (Join-Path $VenvDir "Scripts\pyinstaller.exe") `
  --noconfirm `
  --clean `
  --distpath $BuildDir `
  --workpath (Join-Path $BuildDir ".pyinstaller") `
  $Spec
$code = $LASTEXITCODE
Pop-Location
if ($code -ne 0) { Fail "PyInstaller build failed" }

$Bin = Join-Path $BuildDir "server\server.exe"
if (-not (Test-Path $Bin)) { Fail "Expected binary not found at $Bin" }

Write-Host ""
Log "Server frozen to: $Bin"
Write-Host "        Run standalone: `$env:ECHO_MODELS_DIR='$EchoDir\models'; & '$Bin'"
Write-Host ""
