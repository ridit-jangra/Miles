import asyncio
import time
from collections.abc import Awaitable, Callable

from miles.watchers.inbox import Alert, Inbox


class Notifier:
    def __init__(
        self,
        inbox: Inbox,
        is_busy: Callable[[], bool],
        inform: Callable[[str], None],
        run_llm: Callable[[], Awaitable[None]],
        interrupt: Callable[[], Awaitable[None]],
    ) -> None:
        self.inbox = inbox
        self.is_busy = is_busy
        self.inform = inform
        self.run_llm = run_llm
        self.interrupt = interrupt
        self._waiting: list[Alert] = []
        self._held: list[Alert] = []
        self._quiet_until = 0.0
        self._release: asyncio.Task | None = None
        self._loop = asyncio.get_running_loop()
        inbox.on_new(self.on_alert)

    def quiet_for(self, seconds: float) -> None:
        self._loop.call_soon_threadsafe(self._start_quiet, seconds)

    def end_quiet(self) -> int:
        held = len(self._held)
        self._loop.call_soon_threadsafe(self._end_quiet)
        return held

    def _start_quiet(self, seconds: float) -> None:
        self._quiet_until = time.time() + seconds
        if self._release:
            self._release.cancel()
        self._release = asyncio.create_task(self._release_later(seconds))

    async def _release_later(self, seconds: float) -> None:
        await asyncio.sleep(seconds)
        self._end_quiet()

    def _end_quiet(self) -> None:
        self._quiet_until = 0.0
        if self._release and self._release is not asyncio.current_task():
            self._release.cancel()
        self._release = None
        self._waiting.extend(self._held)
        self._held = []
        if not self.is_busy():
            self.on_idle()

    def on_alert(self, alert: Alert) -> None:
        if alert.priority != "urgent" and time.time() < self._quiet_until:
            self._held.append(alert)
        elif alert.priority == "low":
            ...
        elif alert.priority == "urgent":
            asyncio.create_task(self._deliver_urgent(alert))
        elif alert.priority == "normal":
            if self.is_busy():
                self._waiting.append(alert)
            else:
                asyncio.create_task(self._deliver([alert]))

    async def _deliver_urgent(self, alert: Alert) -> None:
        await self.interrupt()
        await self._deliver([alert])

    def on_idle(self) -> None:
        waiting = self._waiting
        self._waiting = []
        fresh = [a for a in waiting if not self.inbox.is_expired(a)]
        if fresh:
            asyncio.create_task(self._deliver(fresh))

    async def _deliver(self, alerts: list[Alert]) -> None:
        lines = [f"#{a.id} from {a.source} ({a.priority}): {a.text}" for a in alerts]
        text = (
            "New alerts:\n" + "\n".join(lines)
            + "\nTell the user in one short sentence, in your own words. Don't read the alert text out "
            "word for word. If there are several, say how many and lead with the most important."
        )
        self.inform(text)
        await self.run_llm()
        for a in alerts:
            self.inbox.mark_read(a.id)
