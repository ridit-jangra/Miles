#!/usr/bin/env bash
set -e
ECHO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="$ECHO_DIR/.venv"
PYTHON="$VENV_DIR/bin/python"
BUILD_DIR="$ECHO_DIR/build"
SPEC="$ECHO_DIR/scripts/echo-server.spec"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'
log()  { echo -e "${GREEN}  [✓]${NC} $1"; }
info() { echo -e "${YELLOW}  [~]${NC} $1"; }
err()  { echo -e "${RED}  [✗]${NC} $1"; exit 1; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════╗${NC}"
echo -e "${CYAN}║      Echo Server Freezer         ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════╝${NC}"
echo ""

[ -x "$PYTHON" ] || err "Virtual environment not found. Run setup first: npm run setup"

info "Ensuring PyInstaller is installed..."
"$PYTHON" -m pip install --quiet --upgrade pyinstaller || err "Failed to install PyInstaller"
log "PyInstaller ready"

info "Freezing server.py (GPU if CUDA libs present, else CPU)..."
cd "$ECHO_DIR"
"$VENV_DIR/bin/pyinstaller" \
  --noconfirm \
  --clean \
  --distpath "$BUILD_DIR" \
  --workpath "$BUILD_DIR/.pyinstaller" \
  "$SPEC" || err "PyInstaller build failed"

BIN="$BUILD_DIR/server/server"
[ -f "$BIN" ] || err "Expected binary not found at $BIN"

echo ""
log "Server frozen to: $BIN"
echo -e "        Run standalone: ECHO_MODELS_DIR=\"$ECHO_DIR/models\" \"$BIN\""
echo ""
