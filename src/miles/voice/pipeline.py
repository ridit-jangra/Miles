import os

from loguru import logger
from miles.config import load_config
from miles.plugins.loader import load_plugins
from miles.voice.tools import to_pipecat
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.frames.frames import LLMRunFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import WorkerRunner
from pipecat.pipeline.task import PipelineParams, PipelineWorker
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.runner.types import RunnerArguments
from pipecat.services.openrouter.llm import OpenRouterLLMService
from pipecat.services.piper.tts import PiperTTSService
from pipecat.services.whisper.stt import Model, WhisperSTTService
from pipecat.transports.base_transport import BaseTransport

DEFAULT_SYSTEM_PROMPT = (
    "You are Miles, a voice assistant. Your replies are spoken out loud, so keep them "
    "short and conversational: one to three sentences. No markdown, no lists, no emojis, "
    "no code blocks. Be warm, dry and to the point."
)

async def run(transport: BaseTransport, runner_args: RunnerArguments, system_prompt: str = DEFAULT_SYSTEM_PROMPT) -> None:
    config = load_config()

    stt = WhisperSTTService(
        device="cpu",
        compute_type="int8",
        settings=WhisperSTTService.Settings(model=Model.SMALL)
    )

    llm = OpenRouterLLMService(
        api_key=os.getenv("OPENROUTER_API_KEY"),
        settings=OpenRouterLLMService.Settings(
            model = "anthropic/claude-haiku-5.5",
            system_instruction=system_prompt
        )
    )

    tts = PiperTTSService(
        settings=PiperTTSService.Settings(
            voice="en_US-danny-low"
        )
    )

    tools = load_plugins(config)

    context = LLMContext(tools=[to_pipecat(t) for t in tools])

    user_aggregator, assistant_aggregator = LLMContextAggregatorPair(
        context,
        user_params = LLMUserAggregatorParams(vad_analyzer=SileroVADAnalyzer())
    )

    pipeline = Pipeline([
        transport.input(),
        stt,
        user_aggregator,
        llm,
        tts,
        transport.output(),
        assistant_aggregator
    ])

    task = PipelineWorker(pipeline, params=PipelineParams(enable_usage_metrics=True, enable_metrics=True))

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        logger.info("Client connected")
        context.add_message({"role": "user", "content": "Say hi in one short sentence."})
        await task.queue_frames([LLMRunFrame()])

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info("Client disconnected")
        # manager.cancel_all()
        await task.cancel()

    await WorkerRunner(handle_sigint=runner_args.handle_sigint).run(task)
