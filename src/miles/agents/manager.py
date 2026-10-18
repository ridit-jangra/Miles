import asyncio
import itertools
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field

from loguru import logger

from miles.agents.defination import AgentDef
from miles.agents.runner import run_agent


@dataclass
class Task:
    id: str
    agent: str
    task: str
    status: str = "running"  # running | done | failed | cancelled
    result: str | None = None
    error: str | None = None
    handle: asyncio.Task | None = field(default=None, repr=False)

    def report(self) -> str:
        """A message for the LLM saying how this task ended."""
        if self.status == "done":
            outcome = f"finished. Result: {self.result}"
        else:
            outcome = f"{self.status}. Error: {self.error}"
        return (
            f"Background task {self.id} ({self.agent} agent, asked: {self.task!r}) {outcome}\n"
            "Tell the user briefly, in your own words."
        )


class TaskManager:
    def __init__(
        self,
        agents: dict[str, AgentDef],
        tools: dict[str, Callable],
        default_model: str,
        on_done: Callable[[Task], Awaitable[None]] | None = None,
    ) -> None:
        self.agents = agents
        self.tools = tools
        self.default_model = default_model
        self.on_done = on_done
        self.tasks: dict[str, Task] = {}
        self._ids = itertools.count(1)

    def start(self, agent: str, task: str) -> Task:
        if agent not in self.agents:
            raise ValueError(f"Unknown agent {agent!r}. Available: {list(self.agents)}")
        t = Task(id=f"t{next(self._ids)}", agent=agent, task=task)
        t.handle = asyncio.create_task(self._run(t))
        self.tasks[t.id] = t
        return t

    async def _run(self, t: Task) -> None:
        try:
            t.result = await run_agent(
                self.agents[t.agent], t.task, self.tools, self.default_model
            )
            t.status = "done"
        except asyncio.CancelledError:
            t.status = "cancelled"
            raise
        except Exception as e:
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
