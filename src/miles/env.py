import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HOME_DIR = Path(os.environ.get("MILES_HOME") or Path.home() / ".miles")
os.environ.setdefault("MILES_HOME", str(HOME_DIR))

PLUGINS_DIR = ROOT / "plugins"
USER_PLUGINS_DIR = Path(os.environ.get("MILES_PLUGINS_DIR") or HOME_DIR / "plugins")
PLUGIN_DIRS = [PLUGINS_DIR, USER_PLUGINS_DIR]
DEPS_DIR = HOME_DIR / "deps"
PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"
DEFAULT_CONFIG_PATH = ROOT / "config.toml"
CONFIG_PATH = HOME_DIR / "config.toml"
ENV_PATH = HOME_DIR / ".env"
MEMORY_DIR = HOME_DIR / "memory"
CONTEXT_PATH = HOME_DIR / "context.md"
CONTEXT_CACHE_PATH = HOME_DIR / ".context_cache.json"
