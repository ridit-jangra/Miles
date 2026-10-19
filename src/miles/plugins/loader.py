import importlib.util
from pathlib import Path
import tomllib

from loguru import logger
from miles.config import Config
from miles.confirm.confirmer import Confirmer
from miles.env import PLUGINS_DIR
from miles.plugins.api import PluginContext
from miles.tools.registry import TOOLS


def load_plugins(config: Config, confirmer: Confirmer, dir: Path = PLUGINS_DIR) -> list:
    tools = list(TOOLS)
    if not config.plugins.enabled:
        logger.info("Plugins are disabled in config.")
        return tools
    for folder in sorted(p for p in dir.iterdir() if p.is_dir()):
        manifest, entry = folder / "plugin.toml", folder / "plugin.py"
        if not manifest.exists() or not entry.exists():
            continue
        try:
            meta = tomllib.loads(manifest.read_text())
            name = meta.get("name", folder.name)
            if name in config.plugins.disabled:
                logger.info(f"Plugin {name} is disabled in config.")
                continue
            spec = importlib.util.spec_from_file_location(f"miles_plugin_{name}", entry)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            api = PluginContext(name, config.plugin_settings.get(name, {}), confirmer)
            module.register(api)
            tools.extend(api.tools)
            logger.info(f"Loaded plugin {name} with {len(api.tools)} tools.")
        except Exception as e:
            logger.exception(f"Plugin {folder.name} could not be loaded because an error occured; \n Error: {e}")
    return tools
