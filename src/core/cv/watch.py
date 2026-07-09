import argparse
import asyncio
import json
import time

import websockets


async def run(url: str):
    async for ws in websockets.connect(url):
        print(f"[{time.strftime('%H:%M:%S')}] connected to {url}")
        try:
            async for msg in ws:
                ev = json.loads(msg)
                t = ev.pop("type", "?")
                detail = "  ".join(f"{k}={v}" for k, v in ev.items())
                print(f"[{time.strftime('%H:%M:%S')}] {t:<16} {detail}")
        except websockets.ConnectionClosed:
            print(f"[{time.strftime('%H:%M:%S')}] disconnected, retrying...")
            await asyncio.sleep(2)


def main():
    parser = argparse.ArgumentParser(description="Watch Echo vision events (manual test)")
    parser.add_argument("--port", default="8000")
    args = parser.parse_args()
    try:
        asyncio.run(run(f"ws://127.0.0.1:{args.port}/vision"))
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
