import os

from dotenv import load_dotenv
from miles.voice.pipeline import run_bot
from pipecat.runner.types import RunnerArguments
from pipecat.runner.utils import create_transport
from pipecat.transports.base_transport import TransportParams

load_dotenv(override=True)

SYSTEM_PROMPT = (
    "You are Miles, a voice assistant. Your replies are spoken out loud, so keep them "
    "short and conversational: one to three sentences. No markdown, no lists, no emojis, "
    "no code blocks. Be warm, dry and to the point."
)

async def bot(runner_args: RunnerArguments):
    transport_params = {
        "webrtc": lambda: TransportParams(audio_in_enabled=True, audio_out_enabled=True),
    }
    transport = await create_transport(runner_args, transport_params)
    await run_bot(transport, runner_args, SYSTEM_PROMPT)


if __name__ == "__main__":
    from pipecat.runner.run import main

    main()
