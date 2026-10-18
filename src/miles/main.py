from dotenv import load_dotenv
from pipecat.runner.types import RunnerArguments
from pipecat.runner.utils import create_transport
from pipecat.transports.base_transport import TransportParams

from miles.voice.pipeline import run

load_dotenv(override=True)

async def bot(runner_args: RunnerArguments):
    transport_params = {
        "webrtc": lambda: TransportParams(audio_in_enabled=True, audio_out_enabled=True)
    }
    tranport = await create_transport(runner_args, transport_params)
    await run(tranport, runner_args)

if __name__ == "__main__":
    from pipecat.runner.run import main

    main()
