import importlib.util
from pathlib import Path
import tomllib

from loguru import logger
from miles.agents.definition import load_agents
from miles.config import Config
from miles.confirm.confirmer import Confirmer
from miles.env import PLUGINS_DIR
from miles.mcp.parse import parse_mcp_servers
from miles.plugins.api import PluginBundle, PluginContext
from miles.tools.registry import TOOLS
from miles.watchers.scheduler import Scheduler


def load_plugins(config: Config, confirmer: Confirmer, scheduler: Scheduler, dir: Path = PLUGINS_DIR) -> PluginBundle:
    tools = list(TOOLS)
    plugin_tools = {}
    bundle = PluginBundle(list(tools), {}, plugin_tools)
    if not config.plugins.enabled:
        logger.info("Plugins are disabled in config.")
        return bundle
    for folder in sorted(p for p in dir.iterdir() if p.is_dir()):
        manifest, entry = folder / "plugin.toml", folder / "plugin.py"
        agents_dir = folder / "agents"
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
            api = PluginContext(name, config.plugin_settings.get(name, {}), confirmer, scheduler)
            module.register(api)
            servers = parse_mcp_servers(name, meta.get("mcp", {}))
            bundle.mcp_servers[name] = servers
            bundle.plugin_tools[name] = {fn.__name__: fn for fn in api.tools}
            bundle.tools.extend(api.tools)
            if agents_dir.is_dir():
                for agent in load_agents(agents_dir).values():
                    if agent.name in bundle.agents:
                        logger.error(f"Agent {agent.name!r} from {name} clashes with another plugin's agent, skipping it")
                        continue
                    agent.plugin = name
                    unknown = [s for s in agent.mcp if s not in servers]
                    if unknown:
                        logger.warning(f"Agent {agent.name!r} in plugin {name} lists unknown MCP servers {unknown}")
                    bundle.agents[agent.name] = agent
            logger.info(f"Loaded plugin {name} with {len(api.tools)} tools.")
        except Exception as e:
            logger.exception(f"Plugin {folder.name} could not be loaded because an error occured; \n Error: {e}")
    return bundle
