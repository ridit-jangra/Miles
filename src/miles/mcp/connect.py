import asyncio
from dataclasses import dataclass, field

from loguru import logger
from mcp import StdioServerParameters
from mcp.client.session_group import StreamableHttpParameters
from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.services.mcp_service import MCPClient
from fastmcp.client.transports import StdioTransport

from pydantic_ai.mcp import MCPToolset
from miles.mcp.config import McpServer



@dataclass
class McpConnection:
    clients: list[MCPClient] = field(default_factory=list)
    tools: list[FunctionSchema] = field(default_factory=list)
    status: dict[tuple[str, str], str] = field(default_factory=dict)
    _jobs: list[asyncio.Task] = field(default_factory=list)

    def start(self, servers, on_ready, timeout: float = 60) -> None:
        for plugin, group in servers.items():
            for name, server in group.items():
                if server.miles:
                    self.status[(plugin, name)] = "starting"
                    self._jobs.append(asyncio.create_task(
                        self._run_one(plugin, name, server, timeout, on_ready)))

    async def _run_one(self, plugin, name, server, timeout, on_ready) -> None:
        result = await start_server(plugin, name, server, timeout)
        if result is None:
            self.status[(plugin, name)] = "failed"
            return
        client, schema = result
        self.clients.append(client)
        have = {x.name for x in self.tools}
        new = []
        for tool in schema.standard_tools:
            if tool.name in have:
                logger.warning(f"MCP tool {tool.name!r} is offered by two servers, skipping the second")
                continue
            new.append(tool)
        self.tools.extend(new)
        self.status[(plugin, name)] = "ready"
        on_ready(plugin, name, new)

    async def close(self) -> None:
        for job in self._jobs:
            job.cancel()
        await asyncio.gather(*self._jobs, return_exceptions=True)
        self._jobs.clear()
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

def make_toolset(server: McpServer):
    if server.command is not None:
        toolset = MCPToolset(StdioTransport(server.command, server.args, env=server.env or None, keep_alive=False), init_timeout=30)
    else:
        toolset = MCPToolset(server.url, init_timeout=30)
    if server.tools is not None:
        allowed = set(server.tools)
        toolset = toolset.filtered(lambda ctx, tool: tool.name in allowed)
    return toolset

async def start_server(plugin: str, name: str, server: McpServer, timeout: float):
    client = make_client(server)
    try:
        schema = await asyncio.wait_for(client.tools(), timeout)
    except BaseException as e:
        try:
            await client.close()
        except Exception:
            pass
        if isinstance(e, asyncio.CancelledError):
            raise
        logger.error(f"MCP server {plugin}/{name} failed to start: {e!r}")
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
