from dataclasses import dataclass, field
from time import time


@dataclass
class Alert:
    text: str
    source: str = ""
    priority: str = "normal"
    key: str | None = None
    expires_at: float | None = None
    id: int = 0
    created_at: float = field(default_factory=time)
    read: bool = False

class Inbox:
    def __init__(self) -> None:
        self._alerts: list[Alert] = []
        self._next_id = 1
        self._listeners = []

    def add(self, alert: Alert) -> Alert | None:
        for a in self._alerts:
            if a.key is not None and a.key == alert.key and not a.read:
                return None

        alert.id = self._next_id

        self._next_id+=1

        self._alerts.append(alert)

        for listener in self._listeners:
            listener(alert)

        return alert

    def unread(self, include_expired=False) -> list[Alert]:
        unread_alerts: list[Alert] = []

        for a in self._alerts:
            if include_expired:
                if not a.read or not a.read and self.is_expired(a):
                    unread_alerts.append(a)
            else:
                if not a.read and not self.is_expired(a):
                    unread_alerts.append(a)

        return unread_alerts

    def is_expired(self, alert: Alert) -> bool:
        return alert.expires_at is not None and time() > alert.expires_at

    def on_new(self, fn) -> None:
        self._listeners.append(fn)

    def all(self) -> list[Alert]:
        return self._alerts

    def get(self, alert_id: int) -> Alert | None:
        for a in self._alerts:
            if a.id == alert_id:
                return a
        return None

    def mark_read(self, alert_id: int) -> None:
        alert = self.get(alert_id)
        if alert is not None:
            alert.read = True
