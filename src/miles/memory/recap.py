import asyncio
import time

from loguru import logger
from pydantic_ai.agent import Agent

from miles.config import Config
from miles.memory.store import MemoryStore
from miles.models import build_model

MAX_TRANSCRIPT_CHARS = 6000

RECAP_PROMPT = """Summarize this conversation between a voice assistant called Miles and its user in under 60 words. Say what they talked about, anything left unfinished, and anything the user wanted to do later. Plain sentences, no markdown, no lists. Never invent anything."""


def _ago(ts: float) -> str:
    seconds = max(0, time.time() - ts)
    if seconds < 3600:
        return f"{max(1, int(seconds // 60))} minutes ago"
    if seconds < 86400:
        return f"{int(seconds // 3600)} hours ago"
    return f"{int(seconds // 86400)} days ago"


async def last_session_recap(store: MemoryStore, current: str, config: Config) -> tuple[str, str] | None:
    previous = store.previous_session(current)
    if previous is None:
        return None
    session, ended = previous

    cached = store.read_recap()
    if cached and cached.get("session") == session:
        return cached["summary"], _ago(ended)

    turns = store.turns(session)
    if len(turns) < 2:
        return None
    transcript = "\n".join(f"{role}: {text}" for role, text in turns)[-MAX_TRANSCRIPT_CHARS:]

    settings = config.context
    try:
        model = build_model(settings.provider, settings.model, settings.api_key_env)
        result = await asyncio.wait_for(Agent(model, instructions=RECAP_PROMPT).run(transcript), 20)
    except Exception:
        logger.exception("Last session recap failed")
        return None

    summary = result.output.strip()
    store.write_recap(session, summary)
    return summary, _ago(ended)
