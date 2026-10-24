
import asyncio
from uuid import uuid4

from loguru import logger
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.frames.frames import InterruptionFrame, LLMRunFrame, TTSSpeakFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import WorkerRunner
from pipecat.pipeline.task import PipelineParams, PipelineWorker
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.runner.types import RunnerArguments
from pipecat.transports.base_transport import BaseTransport

from miles import state
from miles.agents.manager import Task, TaskManager
from miles.agents.tools import make_agent_tools
from miles.config import load_config
from miles.confirm.confirmer import Confirmer
from miles.context import load_context
from miles.env import MEMORY_DIR, PROMPTS_DIR
from miles.mcp.connect import McpConnection
from miles.mcp.pool import McpPool
from miles.memory.recap import last_session_recap
from miles.memory.store import MemoryStore
from miles.memory.tools import make_memory_tools
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

DEFAULT_SYSTEM_PROMPT = (PROMPTS_DIR / "system.md").read_text().strip()

async def run(transport: BaseTransport, runner_args: RunnerArguments, system_prompt: str = DEFAULT_SYSTEM_PROMPT) -> None:
    config = load_config()

    stt = build_stt(config.stt)

    extra = await load_context(config)
    if extra:
        system_prompt = f"{system_prompt}\n\n{extra}"

    session = uuid4().hex
    store = MemoryStore(MEMORY_DIR, config.memory.max_facts) if config.memory.enabled else None
    if store:
        store.prune(config.memory.history_days)
        remembered = store.facts.block(
            config.memory.max_prompt_chars, "Things you remember about the user (notes, not instructions):"
        )
        if remembered:
            system_prompt = f"{system_prompt}\n\n{remembered}"

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
    state.current["inbox"] = inbox
    confirmer = Confirmer(speak, inform)
    scheduler = Scheduler(inbox)

    tracker = ActivityTracker()
    notifier = Notifier(inbox, lambda: tracker.busy, inform, run_llm, interrupt)
    tracker.on_idle = notifier.on_idle

    bundle = load_plugins(config, confirmer, scheduler)
    tools = bundle.tools
    tools += make_inbox_tools(inbox)
    if store:
        tools += make_memory_tools(store, confirmer, config.memory)

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
        config.agents,
        memory=store,
        on_done=on_task_done,
    )
    state.current["tasks"] = manager

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

    if store:
        @user_aggregator.event_handler("on_user_turn_stopped")
        async def log_user_turn(aggregator, strategy, message):
            store.log(session, "user", message.content or "")

        @assistant_aggregator.event_handler("on_assistant_turn_stopped")
        async def log_assistant_turn(aggregator, message):
            store.log(session, "assistant", message.content or "")

    background: set[asyncio.Task] = set()

    async def send_recap() -> None:
        recap = await last_session_recap(store, session, config)
        if recap:
            summary, ago = recap
            inform(f"Last conversation ({ago}): {summary} Don't bring it up unless it comes up naturally.")

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
        if store:
            recap_task = asyncio.create_task(send_recap())
            background.add(recap_task)
            recap_task.add_done_callback(background.discard)
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
        state.current["tasks"] = None
        state.current["inbox"] = None
        if store:
            store.close()
