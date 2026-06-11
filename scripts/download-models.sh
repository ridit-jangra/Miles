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

# ── Piper TTS (danny) ─────────────────────────────────────────────────────────
DANNY_ONNX="$MODELS_DIR/en_US-danny-low.onnx"
DANNY_JSON="$MODELS_DIR/en_US-danny-low.onnx.json"
PIPER_BASE_URL="https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/danny/low"

if [ -f "$DANNY_ONNX" ]; then
  log "en_US-danny-low.onnx already exists"
else
  info "Downloading Piper danny voice (~63MB)..."
  curl -L --progress-bar -o "$DANNY_ONNX" "$PIPER_BASE_URL/en_US-danny-low.onnx?download=true" \
    || err "Failed to download en_US-danny-low.onnx"
  log "en_US-danny-low.onnx downloaded"
fi

if [ -f "$DANNY_JSON" ]; then
  log "en_US-danny-low.onnx.json already exists"
else
  info "Downloading Piper danny config..."
  curl -L --progress-bar -o "$DANNY_JSON" "$PIPER_BASE_URL/en_US-danny-low.onnx.json?download=true" \
    || err "Failed to download en_US-danny-low.onnx.json"
  log "en_US-danny-low.onnx.json downloaded"
fi

# ── Whisper ───────────────────────────────────────────────────────────────────
WHISPER_CACHE="$HOME/.cache/huggingface/hub/small"
if [ -d "$WHISPER_CACHE" ]; then
  log "Whisper small model already downloaded"
else
  info "Downloading Whisper small model (~150MB)..."
  TRANSFORMERS_OFFLINE=0 HF_DATASETS_OFFLINE=0 "$PYTHON" -c "
from faster_whisper import WhisperModel
WhisperModel('small', device='cpu', compute_type='int8')
print('ok')
" || err "Failed to download Whisper model"
  log "Whisper small model downloaded"
fi

# ── OpenWakeWord ──────────────────────────────────────────────────────────────
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

# ── Custom wake word ──────────────────────────────────────────────────────────
ECHO_MODEL="$MODELS_DIR/echo.onnx"
if [ -f "$ECHO_MODEL" ]; then
  log "Custom echo.onnx found"
else
  echo ""
  warn "echo.onnx not found at models/echo.onnx"
  echo -e "        Train it on Google Colab using the openWakeWord notebook" 
  echo -e "        then place it at: $ECHO_MODEL"
  echo -e "        Using hey_jarvis as fallback."
  echo ""
fi

echo ""
echo -e "${CYAN}╔══════════════════════════════════╗${NC}"
echo -e "${CYAN}║     All Models Ready!            ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════╝${NC}"
echo ""
echo "  Run npm run server to start Echo"
echo ""