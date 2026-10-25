import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

PLUGINS_DIR = ROOT / "plugins"
USER_PLUGINS_DIR = Path(os.environ.get("MILES_PLUGINS_DIR") or Path.home() / ".miles" / "plugins")
PLUGIN_DIRS = [PLUGINS_DIR, USER_PLUGINS_DIR]
DEPS_DIR = USER_PLUGINS_DIR.parent / "deps"
PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"
CONFIG_PATH = ROOT / "config.toml"
MEMORY_DIR = ROOT / "memory"
CONTEXT_PATH = ROOT / "context.md"
CONTEXT_CACHE_PATH = ROOT / ".context_cache.json"
