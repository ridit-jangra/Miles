import asyncio
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
        inbox.on_new(self.on_alert)

    def on_alert(self, alert: Alert) -> None:
        if alert.priority == "low":
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
        text = "New alerts:\n" + "\n".join(lines) + "\nTell the user briefly."
        self.inform(text)
        await self.run_llm()
        for a in alerts:
            self.inbox.mark_read(a.id)
