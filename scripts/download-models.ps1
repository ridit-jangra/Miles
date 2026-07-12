$ErrorActionPreference = "Stop"

$ECHO_DIR   = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$MODELS_DIR = Join-Path $ECHO_DIR "models"
$VENV_DIR   = Join-Path $ECHO_DIR ".venv"
$PYTHON     = Join-Path $VENV_DIR "Scripts\python.exe"

function Log  { param($s) Write-Host "  [ok] $s" -ForegroundColor Green  }
function Info { param($s) Write-Host "  [~ ] $s" -ForegroundColor Yellow }
function Warn { param($s) Write-Host "  [! ] $s" -ForegroundColor Yellow }
function Err  { param($s) Write-Host "  [x ] $s" -ForegroundColor Red; exit 1 }

New-Item -ItemType Directory -Force -Path $MODELS_DIR | Out-Null

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "      Echo Model Downloader       " -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $PYTHON)) {
    Err "Virtual environment not found. Run setup first: npm run setup"
}

function Download-File {
    param([string]$Url, [string]$Dest)
    $client = New-Object System.Net.WebClient
    $client.Headers.Add("User-Agent", "EchoSetup/1.0")

    $request = [System.Net.WebRequest]::Create($Url)
    $request.AllowAutoRedirect = $true
    $response = $request.GetResponse()
    $finalUrl = $response.ResponseUri.ToString()
    $response.Close()

    Write-Host "    Downloading from: $finalUrl" -ForegroundColor DarkGray
    $client.DownloadFile($finalUrl, $Dest)
}

# ---- Piper TTS (danny) -------------------------------------------------------
$PIPER_BASE   = "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/danny/low"
$DANNY_ONNX   = Join-Path $MODELS_DIR "en_US-danny-low.onnx"
$DANNY_JSON   = Join-Path $MODELS_DIR "en_US-danny-low.onnx.json"

if (Test-Path $DANNY_ONNX) {
    Log "en_US-danny-low.onnx already exists"
} else {
    Info "Downloading Piper danny voice (~63MB)..."
    try {
        Download-File "$PIPER_BASE/en_US-danny-low.onnx?download=true" $DANNY_ONNX
        Log "en_US-danny-low.onnx downloaded"
    } catch {
        Err "Failed to download en_US-danny-low.onnx: $_"
    }
}

if (Test-Path $DANNY_JSON) {
    Log "en_US-danny-low.onnx.json already exists"
} else {
    Info "Downloading Piper danny config..."
    try {
        Download-File "$PIPER_BASE/en_US-danny-low.onnx.json?download=true" $DANNY_JSON
        Log "en_US-danny-low.onnx.json downloaded"
    } catch {
        Err "Failed to download en_US-danny-low.onnx.json: $_"
    }
}

# ---- Whisper -----------------------------------------------------------------
$WHISPER_DIR = Join-Path $MODELS_DIR "whisper"

foreach ($SIZE in @("small.en", "small")) {
    $target = Join-Path $WHISPER_DIR $SIZE
    if (Test-Path $target) {
        Log "Whisper $SIZE already present"
    } else {
        Info "Downloading Whisper $SIZE into models\whisper\$SIZE..."
        $env:TRANSFORMERS_OFFLINE = "0"
        $env:HF_DATASETS_OFFLINE  = "0"
        $result = & $PYTHON -c @"
from faster_whisper import download_model
download_model('$SIZE', output_dir=r'$target')
print('ok')
"@
        if ($LASTEXITCODE -ne 0) { Err "Failed to download Whisper $SIZE" }
        Log "Whisper $SIZE downloaded"
    }
}

# ---- OpenWakeWord ------------------------------------------------------------
$OWW_MODELS = Join-Path $VENV_DIR "Lib\site-packages\openwakeword\resources\models\hey_jarvis_v0.1.onnx"

if (Test-Path $OWW_MODELS) {
    Log "OpenWakeWord models already downloaded"
} else {
    Info "Downloading OpenWakeWord models..."
    $result = & $PYTHON -c @"
import openwakeword
openwakeword.utils.download_models()
print('ok')
"@
    if ($LASTEXITCODE -ne 0) { Err "Failed to download OpenWakeWord models" }
    Log "OpenWakeWord models downloaded"
}

# ---- Custom wake word --------------------------------------------------------
$ECHO_MODEL = Join-Path $MODELS_DIR "echo.onnx"
if (Test-Path $ECHO_MODEL) {
    Log "Custom echo.onnx found"
} else {
    Write-Host ""
    Warn "echo.onnx not found at models\echo.onnx"
    Write-Host "        Train it on Google Colab using the openWakeWord notebook" -ForegroundColor DarkGray
    Write-Host "        then place it at: $ECHO_MODEL" -ForegroundColor DarkGray
    Write-Host "        Using hey_jarvis as fallback." -ForegroundColor DarkGray
    Write-Host ""
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "        All Models Ready!         " -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Run npm run server to start Echo"
Write-Host ""
