# One-time Windows setup: venv, python deps, whisper.cpp (Vulkan, AMD GPU), ggml model.
# Prereqs (winget): Python 3.11, CMake, VS 2022 Build Tools (C++), Vulkan SDK, Git.
$ErrorActionPreference = "Stop"

$ROOT   = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$VENV   = Join-Path $ROOT ".venv"
$VENDOR = Join-Path $ROOT "vendor"
$WCPP   = Join-Path $VENDOR "whisper.cpp"
$MODEL  = Join-Path $ROOT "models\whisper-cpp\ggml-small.en.bin"

function Info { param($s) Write-Host "  [~ ] $s" -ForegroundColor Yellow }
function Log  { param($s) Write-Host "  [ok] $s" -ForegroundColor Green }

if (-not (Test-Path (Join-Path $VENV "Scripts\python.exe"))) {
    Info "Creating .venv"
    python -m venv $VENV
}
& (Join-Path $VENV "Scripts\python.exe") -m pip install --upgrade pip
& (Join-Path $VENV "Scripts\pip.exe") install -r (Join-Path $ROOT "requirements.txt")
Log "Python deps installed"

if (-not (Test-Path $WCPP)) {
    Info "Cloning whisper.cpp"
    New-Item -ItemType Directory -Force -Path $VENDOR | Out-Null
    git clone --depth 1 https://github.com/ggml-org/whisper.cpp $WCPP
    if ($LASTEXITCODE -ne 0) { throw "git clone failed" }
}
if (-not (Test-Path (Join-Path $WCPP "build\bin\Release\whisper-server.exe"))) {
    Info "Building whisper.cpp with Vulkan"
    Push-Location $WCPP
    cmake -B build -DGGML_VULKAN=1 -DCMAKE_BUILD_TYPE=Release
    if ($LASTEXITCODE -ne 0) { throw "cmake configure failed" }
    cmake --build build --config Release -j
    if ($LASTEXITCODE -ne 0) { throw "cmake build failed" }
    Pop-Location
}
Log "whisper-server.exe built"

if (-not (Test-Path $MODEL)) {
    Info "Downloading ggml-small.en.bin (~470MB)"
    New-Item -ItemType Directory -Force -Path (Split-Path $MODEL) | Out-Null
    Invoke-WebRequest "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.en.bin" -OutFile $MODEL
}
Log "ggml-small.en ready"

# Piper voice, OpenWakeWord models, faster-whisper CPU fallback
& (Join-Path $ROOT "scripts\download-models.ps1")
