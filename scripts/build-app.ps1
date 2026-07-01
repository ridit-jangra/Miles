param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$BuilderArgs
)
$ErrorActionPreference = "Stop"

$EchoDir    = Split-Path -Parent $PSScriptRoot
$ModelsDir  = Join-Path $EchoDir "models"
$ServerBin  = Join-Path $EchoDir "build\server\server.exe"

function Log($m)  { Write-Host "  [ok] $m"  -ForegroundColor Green }
function Info($m) { Write-Host "  [~ ] $m"  -ForegroundColor Yellow }
function Step($m) { Write-Host "`n> $m"      -ForegroundColor Cyan }
function Fail($m) { Write-Host "  [x ] $m"  -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "         Echo App Builder         " -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan

# -- 1. Models -----------------------------------------------------------------
Step "Models"
$danny    = Join-Path $ModelsDir "en_US-danny-low.onnx"
$wSmall   = Join-Path $ModelsDir "whisper\small\model.bin"
$wSmallEn = Join-Path $ModelsDir "whisper\small.en\model.bin"
if ((Test-Path $danny) -and (Test-Path $wSmall) -and (Test-Path $wSmallEn)) {
    Log "Models already present - skipping download"
} else {
    Info "Models missing - running download-models.ps1"
    & powershell -ExecutionPolicy Bypass -File (Join-Path $EchoDir "scripts\download-models.ps1")
    if ($LASTEXITCODE -ne 0) { Fail "Model download failed" }
}

# -- 2. Frozen server ----------------------------------------------------------
Step "Python server"
if (Test-Path $ServerBin) {
    Log "Frozen server already built at build\server\server.exe - skipping"
} else {
    Info "Frozen server missing - running build-server.ps1"
    & powershell -ExecutionPolicy Bypass -File (Join-Path $EchoDir "scripts\build-server.ps1")
    if ($LASTEXITCODE -ne 0) { Fail "Server build failed" }
}

# -- 3. Electron app -----------------------------------------------------------
# Remaining args are forwarded to electron-builder. Defaults to an unpacked
# Windows dir build (fast, for testing) when none are given.
if (-not $BuilderArgs -or $BuilderArgs.Count -eq 0) {
    $BuilderArgs = @("--dir", "--win")
}

Step "Electron app (electron-builder $($BuilderArgs -join ' '))"
Push-Location $EchoDir
& npx electron-vite build
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "electron-vite build failed" }
& npx electron-builder @BuilderArgs
$code = $LASTEXITCODE
Pop-Location
if ($code -ne 0) { Fail "electron-builder failed" }

Write-Host ""
Log "Output in: $EchoDir\dist\"
Write-Host ""
