import importlib.util
import tomllib
from pathlib import Path

from loguru import logger

from miles.agents.definition import load_agents
from miles.config import Config
from miles.confirm.confirmer import Confirmer
from miles.env import PLUGIN_DIRS
from miles.mcp.parse import parse_mcp_servers
from miles.plugins import deps
from miles.plugins.api import PluginBundle, PluginContext
from miles.tools.registry import TOOLS
from miles.watchers.notifier import Notifier
from miles.watchers.scheduler import Scheduler


def plugin_folders(dirs: list[Path] = PLUGIN_DIRS) -> list[Path]:
    folders = []
    seen = set()
    for dir in dirs:
        if not dir.is_dir():
            continue
        for folder in sorted(p for p in dir.iterdir() if p.is_dir()):
            if folder.name in seen:
                logger.error(f"Plugin folder {folder} clashes with an earlier {folder.name!r}, skipping it")
                continue
            seen.add(folder.name)
            folders.append(folder)
    return folders


def miles_tools(plugin: str, meta: dict, tools: list) -> list:
    wanted = meta.get("miles", {}).get("tools", True)
    if wanted is True:
        return tools
    if wanted is False:
        return []
    names = {fn.__name__ for fn in tools}
    unknown = [n for n in wanted if n not in names]
    if unknown:
        logger.warning(f"Plugin {plugin} lists unknown tools in [miles] tools: {unknown}")
    return [fn for fn in tools if fn.__name__ in wanted]


def load_plugins(
    config: Config,
    confirmer: Confirmer,
    scheduler: Scheduler,
    dirs: list[Path] = PLUGIN_DIRS,
    notifier: Notifier | None = None,
) -> PluginBundle:
    tools = list(TOOLS)
    plugin_tools = {}
    bundle = PluginBundle(list(tools), {}, plugin_tools)
    if not config.plugins.enabled:
        logger.info("Plugins are disabled in config.")
        return bundle
    for folder in plugin_folders(dirs):
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
            deps.activate(folder)
            spec = importlib.util.spec_from_file_location(f"miles_plugin_{name}", entry)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            api = PluginContext(name, config.plugin_settings.get(name, {}), confirmer, scheduler, notifier)
            module.register(api)
            servers = parse_mcp_servers(name, meta.get("mcp", {}))
            bundle.mcp_servers[name] = servers
            bundle.plugin_tools[name] = {fn.__name__: fn for fn in api.tools}
            bundle.tools.extend(miles_tools(name, meta, api.tools))
            if agents_dir.is_dir():
                for agent in load_agents(agents_dir).values():
                    if agent.name in bundle.agents:
                        logger.error(f"Agent {agent.name!r} from {name} clashes with another plugin's agent, skipping it")
                        continue
                    agent.plugin = name
                    missing = [t for t in agent.tools if t not in bundle.plugin_tools[name]]
                    if missing:
                        logger.warning(f"Agent {agent.name!r} in plugin {name} lists unknown tools {missing}")
                    unknown = [s for s in agent.mcp if s not in servers]
                    if unknown:
                        logger.warning(f"Agent {agent.name!r} in plugin {name} lists unknown MCP servers {unknown}")
                    bundle.agents[agent.name] = agent
            logger.info(f"Loaded plugin {name} with {len(api.tools)} tools.")
        except Exception as e:  # noqa: BLE001
            logger.exception(f"Plugin {folder.name} could not be loaded because an error occured; \n Error: {e}")
    return bundle
