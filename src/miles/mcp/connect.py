import asyncio
from dataclasses import dataclass, field

from loguru import logger
from mcp import StdioServerParameters
from mcp.client.session_group import StreamableHttpParameters
from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.services.mcp_service import MCPClient

from miles.mcp.config import McpServer


@dataclass
class McpConnection:
    clients: list[MCPClient] = field(default_factory=list)
    tools: list[FunctionSchema] = field(default_factory=list)

    async def close(self) -> None:
        for client in self.clients:
            try:
                await client.close()
            except Exception:
                logger.exception("Failed to close an MCP client")
        self.clients.clear()


def make_client(server: McpServer) -> MCPClient:
    if server.command is not None:
        params = StdioServerParameters(
            command=server.command, args=server.args, env=server.env or None
        )
    else:
        params = StreamableHttpParameters(url=server.url)
    return MCPClient(params, tools_filter=server.tools)


async def start_server(plugin: str, name: str, server: McpServer, timeout: float):
    client = make_client(server)
    try:
        schema = await asyncio.wait_for(client.tools(), timeout)
    except Exception as e:
        logger.error(f"MCP server {plugin}/{name} failed to start: {e!r}")
        try:
            await client.close()
        except Exception:
            pass
        return None
    logger.info(f"MCP server {plugin}/{name} started with {len(schema.standard_tools)} tools")
    return client, schema


async def connect_servers(
    servers: dict[str, dict[str, McpServer]], timeout: float = 20
) -> McpConnection:
    jobs = [
        start_server(plugin, name, server, timeout)
        for plugin, group in servers.items()
        for name, server in group.items()
        if server.miles
    ]
    results = await asyncio.gather(*jobs)

    conn = McpConnection()
    seen: dict[str, int] = {}
    for result in results:
        if result is None:
            continue
        client, schema = result
        conn.clients.append(client)
        for tool in schema.standard_tools:
            if tool.name in seen:
                logger.warning(f"MCP tool {tool.name!r} is offered by two servers, skipping the second")
                continue
            seen[tool.name] = 1
            conn.tools.append(tool)
    return conn
