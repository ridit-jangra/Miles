from pydantic import ValidationError
from loguru import logger
from miles.mcp.config import McpServer

def parse_mcp_servers(plugin: str, raw: dict) -> dict[str, McpServer]:
    servers = {}
    for name, data in raw.items():
        try:
            servers[name] = McpServer(**data)
        except (ValidationError, TypeError) as e:
            logger.error(f"Bad server ({name}) entry from plugin {plugin}; got error {e}")
    return servers
