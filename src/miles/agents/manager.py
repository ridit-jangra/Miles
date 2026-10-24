import asyncio
import itertools
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field

from loguru import logger

from miles.agents.definition import AgentDef
from miles.agents.runner import run_agent
from miles.config import AgentsSettings
from miles.mcp.pool import McpPool
from miles.memory.store import MemoryStore
from miles.memory.tools import make_note_tool
from miles.models import build_model


@dataclass
class Task:
    id: str
    agent: str
    task: str
    status: str = "running"  # running | done | failed | cancelled
    result: str | None = None
    error: str | None = None
    handle: asyncio.Task | None = field(default=None, repr=False)
    started: float = field(default_factory=time.time)
    ended: float | None = None

    def report(self) -> str:
        """A message for the LLM saying how this task ended."""
        if self.status == "done":
            outcome = f"finished. Result: {self.result}"
            ending = (
                "Tell the user what came of it in one short sentence. Give only the result, "
                "not how the agent got it. If the result only describes steps taken, just say it's done."
            )
        else:
            outcome = f"{self.status}. Error: {self.error}"
            ending = (
                "Tell the user in one short sentence that it failed and why, in plain words. "
                "Don't read the error text out."
            )
        return f"Background task {self.id} ({self.agent} agent, asked: {self.task!r}) {outcome}\n{ending}"


class TaskManager:
    def __init__(
        self,
        agents: dict[str, AgentDef],
        plugin_tools: dict[str, dict[str, Callable]],
        builtin_tools: dict[str, Callable],
        mcp_pool: McpPool,
        settings: AgentsSettings,
        memory: MemoryStore | None = None,
        on_done: Callable[[Task], Awaitable[None]] | None = None,
    ) -> None:
        self.agents = agents
        self.settings = settings
        self.memory = memory
        self.on_done = on_done
        self.tasks: dict[str, Task] = {}
        self._ids = itertools.count(1)
        self.plugin_tools = plugin_tools
        self.builtin_tools = builtin_tools
        self.mcp_pool = mcp_pool

    def start(self, agent: str, task: str) -> Task:
        if agent not in self.agents:
            raise ValueError(f"Unknown agent {agent!r}. Available: {list(self.agents)}")
        t = Task(id=f"t{next(self._ids)}", agent=agent, task=task)
        t.handle = asyncio.create_task(self._run(t))
        self.tasks[t.id] = t
        return t

    async def _run(self, t: Task) -> None:
        try:
            agent_def = self.agents[t.agent]
            toolsets = await self.mcp_pool.toolsets_for(agent_def.plugin, agent_def.mcp)
            model = build_model(self.settings.provider, agent_def.model or self.settings.model, self.settings.api_key_env)
            notes = None
            extra_tools = ()
            if agent_def.memory and self.memory:
                file = self.memory.agent_notes(agent_def.name)
                notes = file.block(1500, "Your notes from earlier tasks:")
                extra_tools = (make_note_tool(file),)
            t.result = await run_agent(
                agent_def, t.task, self._tools_for(agent_def), model,
                toolsets=toolsets, memory=notes, extra_tools=extra_tools,
            )
            t.status = "done"
        except asyncio.CancelledError:
            t.status = "cancelled"
            raise
        except Exception as e:  # noqa: BLE001
            logger.exception(f"Agent task {t.id} failed")
            t.status = "failed"
            t.error = str(e)
        if self.on_done:
            await self.on_done(t)

    def cancel(self, task_id: str) -> bool:
        t = self.tasks.get(task_id)
        if not t or t.status != "running":
            return False
        t.status = "cancelled"  # set now, the task may never get to run its except block
        t.handle.cancel()
        return True

    def cancel_all(self) -> None:
        for task_id in list(self.tasks):
            self.cancel(task_id)

    def _tools_for(self, agent: AgentDef) -> dict[str, Callable]:
        return {**self.builtin_tools, **self.plugin_tools.get(agent.plugin, {})}
