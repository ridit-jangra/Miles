#!/usr/bin/env sh
set -e

ECHO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SITE="$ECHO_DIR/.venv/lib/python"*"/site-packages"
NVIDIA_LIBS="$(echo $SITE/nvidia/*/lib | tr ' ' ':')"
export LD_LIBRARY_PATH="${NVIDIA_LIBS}${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"

cd "$ECHO_DIR/src/core/server"
exec "$ECHO_DIR/.venv/bin/uvicorn" server:app --host 127.0.0.1 --port 8000 --log-level info --reload
