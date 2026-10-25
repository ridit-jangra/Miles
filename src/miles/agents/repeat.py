import asyncio
import itertools
from dataclasses import dataclass, field

from miles.agents.manager import TaskManager
from miles.watchers.parser import parse_time

MIN_SECONDS = 30
MAX_ACTIVE = 5
MAX_RUNS = 500


@dataclass
class Repeat:
    id: str
    agent: str
    task: str
    every: str
    seconds: float
    max_runs: int
    runs: int = 0
    last_task: str | None = None
    handle: asyncio.Task | None = field(default=None, repr=False)


class Repeater:
    """Runs a background agent again and again on a timer. Each run is an ordinary task, so it is reported when it finishes."""

    def __init__(self, manager: TaskManager) -> None:
        self.manager = manager
        self.repeats: dict[str, Repeat] = {}
        self._ids = itertools.count(1)

    def start(self, agent: str, task: str, every: str, times: int = 0, start_now: bool = True) -> Repeat:
        if agent not in self.manager.agents:
            raise ValueError(f"Unknown agent {agent!r}. Available: {list(self.manager.agents)}")
        seconds = parse_time(every)
        if seconds < MIN_SECONDS:
            raise ValueError(f"Too often. The shortest interval is {MIN_SECONDS} seconds.")
        if len(self.repeats) >= MAX_ACTIVE:
            raise ValueError(f"There are already {MAX_ACTIVE} repeating jobs. Stop one first.")
        r = Repeat(f"r{next(self._ids)}", agent, task, every, seconds, min(times, MAX_RUNS) if times > 0 else MAX_RUNS)
        self.repeats[r.id] = r
        r.handle = asyncio.create_task(self._loop(r, start_now))
        return r

    async def _loop(self, r: Repeat, start_now: bool) -> None:
        try:
            if not start_now:
                await asyncio.sleep(r.seconds)
            while True:
                last = self.manager.tasks.get(r.last_task) if r.last_task else None
                if not last or last.status != "running":
                    r.last_task = self.manager.start(r.agent, r.task).id
                    r.runs += 1
                    if r.runs >= r.max_runs:
                        return
                await asyncio.sleep(r.seconds)
        finally:
            self.repeats.pop(r.id, None)

    def stop(self, repeat_id: str) -> bool:
        r = self.repeats.get(repeat_id)
        if not r or not r.handle:
            return False
        r.handle.cancel()
        self.repeats.pop(repeat_id, None)
        return True

    def stop_all(self) -> None:
        for repeat_id in list(self.repeats):
            self.stop(repeat_id)
