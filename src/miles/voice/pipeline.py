import os

from loguru import logger
from miles.agents.manager import Task, TaskManager
from miles.agents.tools import make_agent_tools
from miles.config import load_config
from miles.confirm.confirmer import Confirmer
from miles.mcp.connect import McpConnection, connect_servers
from miles.mcp.pool import McpPool
from miles.plugins.loader import load_plugins
from miles.providers import build_llm, build_stt, build_tts, close_providers
from miles.tools.registry import TOOLS
from miles.voice.confirm_processor import ConfirmProcessor
from miles.voice.tools import to_pipecat
from miles.watchers.activity import ActivityTracker
from miles.watchers.inbox import Inbox
from miles.watchers.notifier import Notifier
from miles.watchers.scheduler import Scheduler
from miles.watchers.tools import make_inbox_tools
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.frames.frames import LLMRunFrame, TTSSpeakFrame, InterruptionFrame
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

    stt = build_stt(config.stt)
    llm = build_llm(config.llm, system_prompt)
    tts = build_tts(config.tts)

    async def speak(text: str) -> None:
        await task.queue_frame(TTSSpeakFrame(text))

    async def run_llm() -> None:
        tracker.expect_response()
        await task.queue_frames([LLMRunFrame()])

    async def interrupt() -> None:
        await task.queue_frame(InterruptionFrame())

    def inform(text: str) -> None:
        context.add_message({"role": "developer", "content": text})

    inbox = Inbox()
    confirmer = Confirmer(speak, inform)
    scheduler = Scheduler(inbox)

    tracker = ActivityTracker()
    notifier = Notifier(inbox, lambda: tracker.busy, inform, run_llm, interrupt)
    tracker.on_idle = notifier.on_idle

    bundle = load_plugins(config, confirmer, scheduler)
    tools = bundle.tools
    tools += make_inbox_tools(inbox)

    mcp_pool = McpPool()
    mcp_pool.start(
        bundle.mcp_servers,
        wanted={(a.plugin, n) for a in bundle.agents.values() for n in a.mcp},
    )

    async def on_task_done(t: Task):
        context.add_message({"role": "developer", "content": t.report()})
        await task.queue_frames([LLMRunFrame()])

    manager = TaskManager(
        bundle.agents,
        bundle.plugin_tools,
        {t.__name__: t for t in TOOLS},
        mcp_pool,
        config.agents.model,
        on_done=on_task_done,
    )
    tools += make_agent_tools(manager)

    base_tools = [to_pipecat(t) for t in tools]
    context = LLMContext(tools=list(base_tools))

    def on_mcp_ready(plugin, name, new_tools):
        context.set_tools(base_tools + mcp_conn.tools)
        inform(f"New tools are now available from {plugin}/{name}: " + ", ".join(t.name for t in new_tools))

    mcp_conn = McpConnection()
    mcp_conn.start(bundle.mcp_servers, on_mcp_ready)

    user_aggregator, assistant_aggregator = LLMContextAggregatorPair(
        context,
        user_params = LLMUserAggregatorParams(
            vad_analyzer=SileroVADAnalyzer(),
            empty_user_turn=None
        ),
    )

    pipeline = Pipeline([
        transport.input(),
        stt,
        ConfirmProcessor(confirmer),
        user_aggregator,
        llm,
        tts,
        transport.output(),
        assistant_aggregator,
        tracker,
    ])

    task = PipelineWorker(pipeline, params=PipelineParams(enable_usage_metrics=True, enable_metrics=True))

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        logger.info("Client connected")
        context.add_message({"role": "user", "content": "Say hi in one short sentence."})
        tracker.expect_response()
        scheduler.start()
        await task.queue_frames([LLMRunFrame()])

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info("Client disconnected")
        manager.cancel_all()
        await scheduler.stop()
        confirmer.cancel()
        await task.cancel()

    try:
        await WorkerRunner(handle_sigint=runner_args.handle_sigint).run(task)
    finally:
        await mcp_pool.close()
        await mcp_conn.close()
        await close_providers()
