import os

from loguru import logger
from miles.agents.defination import load_agents
from miles.agents.manager import Task, TaskManager
from miles.agents.tools import make_agent_tools
from miles.config import load_config
from miles.env import AGENTS_DIR
from miles.plugins.loader import load_plugins
from miles.voice.tools import to_pipecat
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.frames.frames import LLMRunFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.runner.types import RunnerArguments
from pipecat.runner.utils import create_transport
from pipecat.services.kokoro.tts import KokoroTTSService
from pipecat.services.openrouter.llm import OpenRouterLLMService
from pipecat.services.whisper.stt import Model, WhisperSTTService
from pipecat.transports.base_transport import BaseTransport, TransportParams
from pipecat.services.piper.tts import PiperHttpTTSService, PiperTTSService

async def run_bot(transport: BaseTransport, runner_args: RunnerArguments, system_prompt: str):
    config = load_config()

    stt = WhisperSTTService(
        device="cpu",
        compute_type="int8",
        settings=WhisperSTTService.Settings(model=Model.SMALL),
    )

    llm = OpenRouterLLMService(
        api_key=os.getenv("OPENROUTER_API_KEY"),
        settings=OpenRouterLLMService.Settings(
            model=os.getenv("OPENROUTER_MODEL", config.miles.model),
            system_instruction=system_prompt,
        ),
    )

    tts = PiperTTSService(
        settings=PiperTTSService.Settings(voice=config.miles.voice),
    )

    tools = load_plugins(config)

    async def on_task_done(t: Task):
        context.add_message({"role": "developer", "content": t.report()})
        await task.queue_frames([LLMRunFrame()])

    # subagents only get the plugin tools, so they can't delegate to each other
    manager = TaskManager(
        load_agents(AGENTS_DIR),
        {t.__name__: t for t in tools},
        config.miles.model,
        on_done=on_task_done,
    )
    tools += make_agent_tools(manager)

    context = LLMContext(tools=[to_pipecat(t) for t in tools])
    user_aggregator, assistant_aggregator = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(vad_analyzer=SileroVADAnalyzer()),
    )

    pipeline = Pipeline(
        [
            transport.input(),
            stt,
            user_aggregator,
            llm,
            tts,
            transport.output(),
            assistant_aggregator,
        ]
    )

    task = PipelineTask(pipeline, params=PipelineParams(enable_metrics=True))

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        logger.info("Client connected")
        context.add_message({"role": "user", "content": "Say hi in one short sentence."})
        await task.queue_frames([LLMRunFrame()])

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info("Client disconnected")
        manager.cancel_all()
        await task.cancel()

    await PipelineRunner(handle_sigint=runner_args.handle_sigint).run(task)
