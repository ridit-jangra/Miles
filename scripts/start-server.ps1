$ErrorActionPreference = "Stop"

$ECHO_DIR   = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$VENV_DIR   = Join-Path $ECHO_DIR ".venv"
$UVICORN    = Join-Path $VENV_DIR "Scripts\uvicorn.exe"
$NVIDIA_DIR = Join-Path $VENV_DIR "Lib\site-packages\nvidia"

if (-not (Test-Path $UVICORN)) {
    Write-Host "  [x] uvicorn not found in venv. Run setup first." -ForegroundColor Red
    exit 1
}

if (Test-Path $NVIDIA_DIR) {
    $binDirs = Get-ChildItem -Path $NVIDIA_DIR -Directory |
        ForEach-Object { Join-Path $_.FullName "bin" } |
        Where-Object { Test-Path $_ }
    if ($binDirs) {
        $env:PATH = ($binDirs -join ";") + ";" + $env:PATH
    }
}

$WHISPER_EXE   = Join-Path $ECHO_DIR "vendor\whisper.cpp\build\bin\Release\whisper-server.exe"
$WHISPER_MODEL = Join-Path $ECHO_DIR "models\whisper-cpp\ggml-small.en.bin"
$whisperProc = $null
if ((Test-Path $WHISPER_EXE) -and (Test-Path $WHISPER_MODEL)) {
    $whisperProc = Start-Process -FilePath $WHISPER_EXE -PassThru -WindowStyle Hidden `
        -ArgumentList "-m", "`"$WHISPER_MODEL`"", "--host", "127.0.0.1", "--port", "8178", "-l", "en", "-fa"
    Write-Host "  [ok] whisper.cpp (Vulkan) started, pid $($whisperProc.Id)" -ForegroundColor Green
} else {
    Write-Host "  [!] whisper.cpp not built, STT falls back to faster-whisper (CPU). Run scripts\setup-windows.ps1" -ForegroundColor Yellow
}

Set-Location (Join-Path $ECHO_DIR "src\core\server")
try {
    & $UVICORN server:app --host 127.0.0.1 --port 8000 --log-level info --reload
} finally {
    # runs on Ctrl+C too, so whisper-server doesn't linger on port 8178
    if ($whisperProc -and -not $whisperProc.HasExited) { Stop-Process -Id $whisperProc.Id -Force }
}
