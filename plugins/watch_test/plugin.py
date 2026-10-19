from datetime import datetime
from time import time

from miles.watchers.inbox import Alert


def register(api):
    tick_every = api.config.get("tick_every", "20s")

    @api.watch(every=tick_every)
    def clock():
        """Normal alert: waits until Miles and the user are quiet."""
        now = datetime.now().strftime("%H:%M:%S")
        return Alert(f"Test alert, the time is {now}", priority="normal", expires_at=time() + 60)

    @api.watch(every="45s", first_run="after")
    def heads_up():
        """Low alert: never spoken, only shows up if Miles checks the inbox."""
        return Alert("Low priority test note", priority="low", key="watch-test-low")

    @api.watch(every="1m", first_run="after")
    def fire():
        """Urgent alert: interrupts whatever Miles is saying."""
        return Alert("URGENT test alert, say it right now", priority="urgent", key="watch-test-urgent")
