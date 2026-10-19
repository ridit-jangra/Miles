from collections.abc import Callable

from miles.watchers.inbox import Inbox


def make_inbox_tools(inbox: Inbox) -> list[Callable]:
    def check_inbox(include_expired: bool = False) -> dict:
        return {"alerts": inbox.unread(include_expired)}

    def read_alert(alert_id: int) -> dict:
        alert = inbox.get(alert_id)
        if not alert:
            return {"error": f"No alert with id {alert_id} found"}
        inbox.mark_read(alert_id)
        return {"alert": alert}

    return [check_inbox, read_alert]
