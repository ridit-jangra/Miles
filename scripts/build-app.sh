#!/usr/bin/env bash
set -e
ECHO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODELS_DIR="$ECHO_DIR/models"
SERVER_BIN="$ECHO_DIR/build/server/server"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'
log()  { echo -e "${GREEN}  [✓]${NC} $1"; }
info() { echo -e "${YELLOW}  [~]${NC} $1"; }
step() { echo -e "\n${CYAN}▶ $1${NC}"; }
err()  { echo -e "${RED}  [✗]${NC} $1"; exit 1; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════╗${NC}"
echo -e "${CYAN}║        Echo App Builder          ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════╝${NC}"

# ── 1. Models ─────────────────────────────────────────────────────────────────
step "Models"
if [ -f "$MODELS_DIR/en_US-danny-low.onnx" ] \
  && [ -f "$MODELS_DIR/whisper/small/model.bin" ] \
  && [ -f "$MODELS_DIR/whisper/small.en/model.bin" ]; then
  log "Models already present — skipping download"
else
  info "Models missing — running download-models.sh"
  bash "$ECHO_DIR/scripts/download-models.sh" || err "Model download failed"
fi

# ── 2. Frozen server ──────────────────────────────────────────────────────────
step "Python server"
if [ -f "$SERVER_BIN" ]; then
  log "Frozen server already built at build/server/server — skipping"
else
  info "Frozen server missing — running build-server.sh"
  bash "$ECHO_DIR/scripts/build-server.sh" || err "Server build failed"
fi

# ── 3. Electron app ───────────────────────────────────────────────────────────
# Extra args are forwarded to electron-builder. Defaults to an unpacked
# Linux dir build (fast, for testing) when none are given.
BUILDER_ARGS=("$@")
if [ ${#BUILDER_ARGS[@]} -eq 0 ]; then
  BUILDER_ARGS=(--dir --linux)
fi

step "Electron app (electron-builder ${BUILDER_ARGS[*]})"
cd "$ECHO_DIR"

# /tmp is a small RAM-backed tmpfs on this system; fpm (deb) stages the full
# ~12GB unpacked tree there and overflows it (EDQUOT). Point the build's temp
# at disk-backed storage under dist/ instead.
BUILD_TMP="$ECHO_DIR/dist/.build-tmp"
mkdir -p "$BUILD_TMP"
export TMPDIR="$BUILD_TMP" TMP="$BUILD_TMP" TEMP="$BUILD_TMP"
trap 'rm -rf "$BUILD_TMP"' EXIT

npx electron-vite build || err "electron-vite build failed"
npx electron-builder "${BUILDER_ARGS[@]}" || err "electron-builder failed"

echo ""
log "Output in: $ECHO_DIR/dist/"
echo ""
