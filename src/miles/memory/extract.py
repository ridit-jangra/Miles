import asyncio
from datetime import date

from loguru import logger
from pydantic_ai.agent import Agent

from miles.config import Config
from miles.memory.store import MemoryStore
from miles.models import build_model

MAX_FACTS_PER_MESSAGE = 3
MAX_SAVES_PER_SESSION = 20
CONTEXT_TURNS = 6      # earlier lines of the conversation shown to the extractor
CONTEXT_CHARS = 400    # of each line

EXTRACT_PROMPT = """You read what a user just said to their voice assistant and pick out lasting facts about the user worth remembering in later conversations: who they are, their school or work, where they live, their projects, plans, preferences, the people in their life, and things going on in their life that will still matter later, like something that happened to them, something they are waiting on or a problem they are dealing with.

You are given the known facts, the last few lines of the conversation, and the user's new message.

Rules:
- Only save what the user says about themselves in the new message. Use the earlier lines only to understand what the message refers to, like what "it" or "banned" means. Never save something that only appears in the earlier lines or that only the assistant said.
- Never save moods, one-off requests, questions, small talk or secrets like passwords and keys.
- Stick to what the user actually said. Don't guess details they didn't state, like who wrote or did something, or why.
- Pointing at something, like "see the post in..." or "check my mail", is a request, not a fact about the user. Don't turn it into one.
- If you can't tell what the message refers to, even with the earlier lines, save nothing.
- Write each fact as one short plain sentence about "the user" that makes sense on its own later. For something that happened or is going on, start with "As of" and today's date, unless the user says when it happened.
- Skip anything already in the known facts.
- Reply with one fact per line and nothing else. If there is nothing worth saving, reply with exactly NONE."""


def make_extractor(store: MemoryStore, config: Config, session: str):
    saved = 0

    def earlier(message: str) -> str:
        """The last few turns before this message, so a short reply like "yes I am" can be understood."""
        turns = store.turns(session)
        if turns and turns[-1] == ("user", message):
            turns = turns[:-1]  # the message itself was logged just before we were called
        lines = [
            f"{'User' if role == 'user' else 'Assistant'}: {' '.join(text.split())[:CONTEXT_CHARS]}"
            for role, text in turns[-CONTEXT_TURNS:]
            if text.strip()
        ]
        return "\n".join(lines) or "(nothing yet)"

    async def extract(message: str) -> None:
        nonlocal saved
        message = message.strip()
        if not message or saved >= MAX_SAVES_PER_SESSION:
            return

        known = "\n".join(f"- {fact}" for fact in store.facts.items()) or "(none)"
        asked = (
            f"Today: {date.today():%d %B %Y}\n\n"
            f"Known facts:\n{known}\n\n"
            f"Earlier in the conversation (only for understanding the message):\n{earlier(message)}\n\n"
            f"New message from the user:\n{message}"
        )
        settings = config.context
        try:
            model = build_model(settings.provider, settings.model, settings.api_key_env)
            result = await asyncio.wait_for(Agent(model, instructions=EXTRACT_PROMPT).run(asked), 20)
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
