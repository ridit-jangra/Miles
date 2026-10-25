import asyncio

from loguru import logger
from pydantic_ai.agent import Agent

from miles.config import Config
from miles.memory.store import MemoryStore
from miles.models import build_model

MAX_FACTS_PER_MESSAGE = 3
MAX_SAVES_PER_SESSION = 20

EXTRACT_PROMPT = """You read one message a user said to their voice assistant and pick out lasting facts about the user worth remembering: who they are, their school or work, where they live, their projects, plans, preferences, people in their life.

Rules:
- Only facts the user states about themselves. Never save moods, one-off requests, questions, small talk or secrets like passwords and keys.
- Write each fact as one short plain sentence about "the user".
- Skip anything already in the known facts.
- Reply with one fact per line and nothing else. If there is nothing worth saving, reply with exactly NONE."""


def make_extractor(store: MemoryStore, config: Config):
    saved = 0

    async def extract(message: str) -> None:
        nonlocal saved
        message = message.strip()
        if not message or saved >= MAX_SAVES_PER_SESSION:
            return

        known = "\n".join(f"- {fact}" for fact in store.facts.items()) or "(none)"
        settings = config.context
        try:
            model = build_model(settings.provider, settings.model, settings.api_key_env)
            result = await asyncio.wait_for(
                Agent(model, instructions=EXTRACT_PROMPT).run(f"Known facts:\n{known}\n\nMessage:\n{message}"),
                20,
            )
        except Exception:  # noqa: BLE001
            logger.exception("Fact extraction failed")
            return

        lines = [line.strip("-• \t") for line in result.output.splitlines()]
        for fact in [line for line in lines if line and line.upper() != "NONE"][:MAX_FACTS_PER_MESSAGE]:
            if saved >= MAX_SAVES_PER_SESSION:
                break
            if store.facts.add(fact, source="said") == "saved":
                saved += 1
                logger.info(f"Remembered: {fact}")

    return extract
