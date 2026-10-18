import importlib.util
from pathlib import Path
import tomllib


from loguru import logger
from miles.config import Config
from miles.env import PLUGINS_DIR
from miles.plugins.api import PluginAPI
from miles.tools.registry import TOOLS


def load_plugins(config: Config, plugins_dir: Path = PLUGINS_DIR) -> list:
    tools = list(TOOLS)
    if not config.plugins.enabled:
        logger.info("Plugins are disabled in config")
        return tools
    for folder in sorted(p for p in plugins_dir.iterdir() if p.is_dir()):
        manifest, entry = folder / "plugin.toml", folder / "plugin.py"
        if not manifest.exists() or not entry.exists():
            continue
        try:
            meta = tomllib.loads(manifest.read_text())
            name = meta.get("name", folder.name)
            if name in config.plugins.disabled:
                logger.info(f"Plugin {name} is disabled")
                continue
            spec = importlib.util.spec_from_file_location(f"miles_plugin_{name}", entry)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            api = PluginAPI(name, config.plugin_settings.get(name, {}))
            module.register(api)
            tools.extend(api.tools)
            logger.info(f"Loaded plugin {name} ({len(api.tools)} tools)")
        except Exception:
            logger.exception(f"Failed to load plugin {folder.name}")
    return tools
