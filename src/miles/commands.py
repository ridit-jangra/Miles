import json
import os
import queue
import signal
import sys
import threading
import time

listening = False
received: queue.Queue = queue.Queue()


def _read() -> None:
    for line in sys.stdin:
        try:
            received.put(json.loads(line))
        except ValueError:
            pass
    os.kill(os.getpid(), signal.SIGINT)
    time.sleep(3)
    os._exit(1)


def listen() -> None:
    global listening
    listening = True
    threading.Thread(target=_read, daemon=True).start()


def wait_for(key: str) -> dict:
    while True:
        message = received.get()
        if isinstance(message, dict) and key in message:
            return message
