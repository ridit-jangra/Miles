#!/bin/bash



set -e

ECHO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODELS_DIR="$ECHO_DIR/models"
VENV_DIR="$ECHO_DIR/.venv"
PYTHON="$VENV_DIR/bin/python"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}  [✓]${NC} $1"; }
info() { echo -e "${YELLOW}  [~]${NC} $1"; }
warn() { echo -e "${YELLOW}  [!]${NC} $1"; }
err()  { echo -e "${RED}  [✗]${NC} $1"; exit 1; }


mkdir -p "$MODELS_DIR"

echo ""
echo -e "${CYAN}╔══════════════════════════════════╗${NC}"
echo -e "${CYAN}║      Echo Model Downloader       ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════╝${NC}"
echo ""


if [ ! -f "$PYTHON" ]; then
  err "Virtual environment not found. Run setup first: npm run setup"
fi


KOKORO_ONNX="$MODELS_DIR/kokoro-v1.0.onnx"
KOKORO_VOICES="$MODELS_DIR/voices-v1.0.bin"
KOKORO_BASE_URL="https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"

if [ -f "$KOKORO_ONNX" ]; then
  log "kokoro-v1.0.onnx already exists"
else
  info "Downloading kokoro-v1.0.onnx..."
  curl -L --progress-bar -o "$KOKORO_ONNX" "$KOKORO_BASE_URL/kokoro-v1.0.onnx" \
    || err "Failed to download kokoro-v1.0.onnx"
  log "kokoro-v1.0.onnx downloaded"
fi

if [ -f "$KOKORO_VOICES" ]; then
  log "voices-v1.0.bin already exists"
else
  info "Downloading voices-v1.0.bin..."
  curl -L --progress-bar -o "$KOKORO_VOICES" "$KOKORO_BASE_URL/voices-v1.0.bin" \
    || err "Failed to download voices-v1.0.bin"
  log "voices-v1.0.bin downloaded"
fi


WHISPER_CACHE="$HOME/.cache/huggingface/hub/models--Systran--faster-whisper-base"

if [ -d "$WHISPER_CACHE" ]; then
  log "Whisper base model already downloaded"
else
  info "Downloading Whisper base model (~150MB)..."
  TRANSFORMERS_OFFLINE=0 HF_DATASETS_OFFLINE=0 "$PYTHON" -c "
from faster_whisper import WhisperModel
WhisperModel('base', device='cpu', compute_type='int8')
print('ok')
" || err "Failed to download Whisper model"
  log "Whisper base model downloaded"
fi

OWW_MODELS_DIR="$VENV_DIR/lib/python3.11/site-packages/openwakeword/resources/models"

if [ -f "$OWW_MODELS_DIR/hey_jarvis_v0.1.onnx" ]; then
  log "OpenWakeWord models already downloaded"
else
  info "Downloading OpenWakeWord models..."
  "$PYTHON" -c "
import openwakeword
openwakeword.utils.download_models()
print('ok')
" || err "Failed to download OpenWakeWord models"
  log "OpenWakeWord models downloaded"
fi

echo ""
echo -e "${CYAN}╔══════════════════════════════════╗${NC}"
echo -e "${CYAN}║     All Models Ready!            ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════╝${NC}"
echo ""
echo "  Run npm run server to start Echo"
echo ""