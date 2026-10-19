import asyncio
from collections.abc import Callable
from dataclasses import dataclass
import inspect

from loguru import logger
from miles.watchers.inbox import Alert, Inbox


@dataclass
class Watcher:
    name: str
    fn: Callable
    seconds: float
    first_run: str = "now"
    overlap: str = "skip"
    running: bool = False

class Scheduler:
    def __init__(self, inbox: Inbox) -> None:
        self.inbox = inbox
        self._watchers: list[Watcher] = []
        self._tasks: set[asyncio.Task] = set()

    def add(self, watcher: Watcher) -> None:
        self._watchers.append(watcher)

    def _spawn(self, coro) -> None:
        task = asyncio.create_task(coro)
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    def start(self) -> None:
        for watcher in self._watchers:
            self._spawn(self._loop(watcher))

    async def stop(self) -> None:
        tasks = list(self._tasks)
        for task in tasks:
            task.cancel()

        await asyncio.gather(*tasks, return_exceptions=True)

    async def _loop(self, watcher: Watcher):
        if watcher.first_run == "after":
            await asyncio.sleep(watcher.seconds)
        while True:
            if watcher.running and watcher.overlap == "skip":
                pass
            else:
                self._spawn(self._run_once(watcher))
            await asyncio.sleep(watcher.seconds)

    async def _run_once(self, watcher: Watcher):
        watcher.running = True
        try:
            result = await asyncio.to_thread(watcher.fn) if not inspect.iscoroutinefunction(watcher.fn) else await watcher.fn()
            if result is None:
                alerts = []
            elif isinstance(result, Alert):
                alerts = [result]
            else:
                alerts = list(result)

            for alert in alerts:
                if not alert.source:
                    alert.source = watcher.name
                self.inbox.add(alert)
        except Exception:
            logger.exception(f"Watcher {watcher.name} failed")
        finally:
            watcher.running = False

if __name__ == "__main__":
    async def main():
        inbox = Inbox()
        inbox.on_new(lambda a: print("NEW:", a.source, a.text))
        s = Scheduler(inbox)
        s.add(Watcher("fast", lambda: Alert("tick"), seconds=1))
        s.add(Watcher("broken", lambda: 1 / 0, seconds=1))
        s.start()
        await asyncio.sleep(4)
        await s.stop()
        print("stopped")

    asyncio.run(main())
