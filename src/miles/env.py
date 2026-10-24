from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

PLUGINS_DIR = ROOT / "plugins"
PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"
CONFIG_PATH = ROOT / "config.toml"
MEMORY_DIR = ROOT / "memory"
CONTEXT_PATH = ROOT / "context.md"
CONTEXT_CACHE_PATH = ROOT / ".context_cache.json"
