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

Set-Location (Join-Path $ECHO_DIR "src\core\server")
& $UVICORN server:app --host 127.0.0.1 --port 8000 --log-level info --reload
