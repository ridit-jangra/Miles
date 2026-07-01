#!/usr/bin/env bash
set -e
ECHO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODELS_DIR="$ECHO_DIR/models"
OUT_DIR="$ECHO_DIR/dist/packs"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${GREEN}  [✓]${NC} $1"; }
info() { echo -e "${YELLOW}  [~]${NC} $1"; }
err()  { echo -e "${RED}  [✗]${NC} $1"; exit 1; }

[ -d "$MODELS_DIR" ] || err "models dir not found — run scripts/download-models.sh first"
mkdir -p "$OUT_DIR"

# Models pack: downloaded on first run (kept out of the app to stay under
# GitHub's 2GB per-asset cap). Tarred from INSIDE models/ so it extracts with
# the same layout the server expects under ECHO_MODELS_DIR.
info "Packing models -> models.tar.gz"
tar -czf "$OUT_DIR/models.tar.gz" -C "$MODELS_DIR" .
( cd "$OUT_DIR" && sha256sum models.tar.gz > models.tar.gz.sha256 )
log "models.tar.gz ($(du -h "$OUT_DIR/models.tar.gz" | cut -f1)) + checksum in dist/packs/"
