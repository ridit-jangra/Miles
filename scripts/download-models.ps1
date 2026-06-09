


$ErrorActionPreference = "Stop"

$ECHO_DIR = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$MODELS_DIR= Join-Path $ECHO_DIR "models"
$VENV_DIR  = Join-Path $ECHO_DIR ".venv"
$PYTHON    = Join-Path $VENV_DIR "Scripts\python.exe"


function Log  { param($s) Write-Host "  [✓] $s" -ForegroundColor Green  }
function Info { param($s) Write-Host "  [~] $s" -ForegroundColor Yellow }
function Warn { param($s) Write-Host "  [!] $s" -ForegroundColor Yellow }
function Err  { param($s) Write-Host "  [✗] $s" -ForegroundColor Red; exit 1 }

New-Item -ItemType Directory -Force -Path $MODELS_DIR | Out-Null

Write-Host ""
Write-Host "╔══════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║      Echo Model Downloader       ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════╝" -ForegroundColor Cyan
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


$KOKORO_BASE = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"
$KOKORO_ONNX   = Join-Path $MODELS_DIR "kokoro-v1.0.onnx"
$KOKORO_VOICES = Join-Path $MODELS_DIR "voices-v1.0.bin"

if (Test-Path $KOKORO_ONNX) {
    Log "kokoro-v1.0.onnx already exists"
} else {
    Info "Downloading kokoro-v1.0.onnx..."
    try {
        Download-File "$KOKORO_BASE/kokoro-v1.0.onnx" $KOKORO_ONNX
        Log "kokoro-v1.0.onnx downloaded"
    } catch {
        Err "Failed to download kokoro-v1.0.onnx: $_"
    }
}

if (Test-Path $KOKORO_VOICES) {
    Log "voices-v1.0.bin already exists"
} else {
    Info "Downloading voices-v1.0.bin..."
    try {
        Download-File "$KOKORO_BASE/voices-v1.0.bin" $KOKORO_VOICES
        Log "voices-v1.0.bin downloaded"
    } catch {
        Err "Failed to download voices-v1.0.bin: $_"
    }
}


$WHISPER_CACHE = Join-Path $env:USERPROFILE ".cache\huggingface\hub\models--Systran--faster-whisper-base"

if (Test-Path $WHISPER_CACHE) {
    Log "Whisper base model already downloaded"
} else {
    Info "Downloading Whisper base model (~150MB)..."
    $env:TRANSFORMERS_OFFLINE = "0"
    $env:HF_DATASETS_OFFLINE  = "0"
    $result = & $PYTHON -c @"
from faster_whisper import WhisperModel
WhisperModel('base', device='cpu', compute_type='int8')
print('ok')
"@
    if ($LASTEXITCODE -ne 0) { Err "Failed to download Whisper model" }
    Log "Whisper base model downloaded"
}


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


$ECHO_MODEL = Join-Path $MODELS_DIR "echo.onnx"
if (Test-Path $ECHO_MODEL) {
    Log "Custom echo.onnx found ✨"
} else {
    Write-Host ""
    Warn "echo.onnx not found at models\echo.onnx"
    Write-Host "        Train it on Google Colab using the openWakeWord notebook" -ForegroundColor DarkGray
    Write-Host "        then place it at: $ECHO_MODEL" -ForegroundColor DarkGray
    Write-Host "        Using hey_jarvis as fallback." -ForegroundColor DarkGray
    Write-Host ""
}

Write-Host ""
Write-Host "╔══════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     All Models Ready!            ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Run npm run server to start Echo"
Write-Host ""