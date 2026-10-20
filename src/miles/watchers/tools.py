from collections.abc import Callable
from time import time

from miles.watchers.inbox import Alert, Inbox


def _view(alert: Alert) -> dict:
    return {
        "id": alert.id,
        "text": alert.text,
        "source": alert.source,
        "priority": alert.priority,
        "age_seconds": int(time() - alert.created_at),
        "read": alert.read
    }

def make_inbox_tools(inbox: Inbox) -> list[Callable]:
    def check_inbox(include_expired: bool = False) -> dict:
        """List unread alerts from background watchers (Slack, YSWS, reminders, ...).

           Use when the user asks what they missed, or if there is any news.

           Args:
               include_expired: Also include alerts that have expired but were never read.
           """
        return {"alerts": [_view(a) for a in inbox.unread(include_expired)]}

    def read_alert(alert_id: int) -> dict:
        """Read one alert in full and mark it as read.

        Args:
            alert_id: The id of an alert from check_inbox.
        """
        alert = inbox.get(alert_id)
        if not alert:
            return {"error": f"No alert with id {alert_id} found"}
        inbox.mark_read(alert_id)
        return {"alert": _view(alert)}

    return [check_inbox, read_alert]
