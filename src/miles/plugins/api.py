from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from miles.agents.definition import AgentDef
from miles.confirm.confirmer import DECLINED, Confirmer
from miles.watchers.parser import parse_time
from miles.watchers.scheduler import Scheduler, Watcher


@dataclass
class PluginBundle:
    tools: list[Callable]
    agents: dict[str, AgentDef]
    plugin_tools: dict[str, dict[str, Callable]]

class PluginContext:
    def __init__(self, name: str, config: dict, confirmer: Confirmer, scheduler: Scheduler) -> None:
        self.name = name
        self.config = config
        self.tools = []
        self._confirmer = confirmer
        self._scheduler = scheduler

    def tool(self, fn: Any) -> Any:
        self.tools.append(fn)
        return fn

    def confirm(self, question: str, action: Callable[[], Any], declined: str = DECLINED) -> dict:
        """Ask the user a yes/no question, and only run `action` if they say yes.

        Return the result from your tool: the LLM asks the question out loud, the
        user's answer is decided by code, and the LLM is told what happened.
        """
        return self._confirmer.request(question, action, declined)

    def watch(self, *, every: str, first_run: str = "now", overlap: str = "skip"):
        """Run the decorated function on a timer. Return None, an Alert, or a list of Alerts."""
        seconds = parse_time(every)                       # raises ValueError on a bad interval
        if first_run not in ("now", "after"):
            raise ValueError(f"first_run must be 'now' or 'after', got {first_run!r}")
        if overlap not in ("skip", "allow"):
            raise ValueError(f"overlap must be 'skip' or 'allow', got {overlap!r}")

        def register(fn):
            self._scheduler.add(Watcher(
                f"{self.name}.{fn.__name__}",
                fn,
                seconds,
                first_run,
                overlap
            ))
            return fn

        return register
