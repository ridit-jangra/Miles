import os
import signal
import sys
import threading
import time

from dotenv import load_dotenv
from pipecat.runner.types import RunnerArguments
from pipecat.runner.utils import create_transport
from pipecat.transports.base_transport import TransportParams

from miles.prefetch import download_models
from miles.voice.pipeline import run

load_dotenv(override=True)

async def bot(runner_args: RunnerArguments):
    transport_params = {
        "webrtc": lambda: TransportParams(audio_in_enabled=True, audio_out_enabled=True)
    }
    tranport = await create_transport(runner_args, transport_params)
    await run(tranport, runner_args)

def exit_with_parent():
    def watch():
        sys.stdin.buffer.read()
        os.kill(os.getpid(), signal.SIGINT)
        time.sleep(3)
        os._exit(1)

    threading.Thread(target=watch, daemon=True).start()

if __name__ == "__main__":
    from pipecat.runner.run import main

    if os.getenv("MILES_EXIT_ON_STDIN_CLOSE"):
        exit_with_parent()
    download_models()

    main()
