import asyncio
import inspect

from loguru import logger


async def _loop(self, w):
    if w.first_run == "after":
        await asyncio.sleep(w.seconds)
    while True:
        if w.running and w.overlap == "skip":
            pass
        else:
            asyncio.create_task(self._run_once(w))
        await asyncio.sleep(w.seconds)

async def _run_once(self, w):
    w.running = True
    try:
        result = await asyncio.to_thread(w.fn) if not inspect.iscoroutinefunction(w.fn) else await w.fn()
        ...   # result is None, one Alert, or a list: send them to the inbox
    except Exception:
        logger.exception(...)   # never let a watcher kill the loop
    finally:
        w.running = False
