from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

PLUGINS_DIR = ROOT / "plugins"
CONFIG_PATH = ROOT / "config.toml"
CONTEXT_PATH = ROOT / "context.md"
CONTEXT_CACHE_PATH = ROOT / ".context_cache.json"
