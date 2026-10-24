import asyncio
from dataclasses import dataclass, field

from loguru import logger

from miles.mcp.config import McpServer
from miles.mcp.connect import make_toolset


@dataclass
class PoolEntry:
    toolset: object | None = None
    status: str = "starting"  # starting | ready | failed
    error: str | None = None
    ready: asyncio.Event = field(default_factory=asyncio.Event)


class McpPool:
    """MCP servers for subagents, started once in the background and shared by every task."""

    def __init__(self) -> None:
        self.entries: dict[tuple[str, str], PoolEntry] = {}
        self._jobs: list[asyncio.Task] = []

    def start(
        self,
        servers: dict[str, dict[str, McpServer]],
        wanted: set[tuple[str, str]] | None = None,
        timeout: float = 60,
    ) -> None:
        """Begin starting servers and return immediately. `wanted` limits it to (plugin, name) pairs."""
        for plugin, group in servers.items():
            for name, server in group.items():
                key = (plugin, name)
                if (wanted is not None and key not in wanted) or key in self.entries:
                    continue
                self.entries[key] = PoolEntry()
                self._jobs.append(asyncio.create_task(self._start_one(key, server, timeout)))

    async def _start_one(self, key: tuple[str, str], server: McpServer, timeout: float) -> None:
        entry = self.entries[key]
        toolset = None
        try:
            toolset = make_toolset(server)
            await asyncio.wait_for(toolset.__aenter__(), timeout)
            entry.toolset, entry.status = toolset, "ready"
            logger.info(f"MCP server {key[0]}/{key[1]} ready")
        except asyncio.CancelledError:
            raise
        except Exception as e:  # noqa: BLE001
            entry.status, entry.error = "failed", repr(e)
            logger.error(f"MCP server {key[0]}/{key[1]} failed to start: {e!r}")
        finally:
            entry.ready.set()

    async def toolsets_for(self, plugin: str, names: list[str], timeout: float = 60) -> list:
        """Wait for the named servers of a plugin and return their toolsets."""
        toolsets = []
        for name in names:
            entry = self.entries.get((plugin, name))
            if entry is None:
                continue
            try:
                await asyncio.wait_for(entry.ready.wait(), timeout)
            except TimeoutError:
                raise RuntimeError(f"MCP server {plugin}/{name} is still starting") from None
            if entry.status != "ready":
                raise RuntimeError(f"MCP server {plugin}/{name} failed to start: {entry.error}")
            toolsets.append(entry.toolset)
        return toolsets

    async def close(self) -> None:
        for job in self._jobs:
            job.cancel()
        await asyncio.gather(*self._jobs, return_exceptions=True)
        self._jobs.clear()
        for key, entry in self.entries.items():
            if entry.status != "ready":
                continue
            try:
                await entry.toolset.__aexit__(None, None, None)
            except Exception:  # noqa: BLE001
                logger.exception(f"Failed to close MCP server {key[0]}/{key[1]}")
        self.entries.clear()
