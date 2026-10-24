import asyncio
import hashlib
import json
import re

from loguru import logger
from pydantic_ai.agent import Agent

from miles.config import Config
from miles.env import CONTEXT_CACHE_PATH, CONTEXT_PATH
from miles.models import build_model

MAX_CHARS = 8000

SECRET_PATTERN = re.compile(r"(xox[abprs]-|sk-[A-Za-z0-9]|ghp_|AKIA[0-9A-Z]{12}|api[_-]?key\s*[:=])", re.IGNORECASE)

SUMMARY_PROMPT = """Turn the user's notes into a short system prompt addendum for a voice assistant called Miles. Write in second person, for example "The user is..." or "Prefer...". Keep only facts that change how Miles should behave or answer. Under 250 words. Plain sentences, no markdown or lists. Never invent facts. Never include tokens, passwords or keys."""


def _digest(text: str, model: str) -> str:
    return hashlib.sha256(f"{model}\n{SUMMARY_PROMPT}\n{text}".encode()).hexdigest()


def _read_cache() -> dict | None:
    try:
        return json.loads(CONTEXT_CACHE_PATH.read_text())
    except (OSError, ValueError):
        return None


def _write_cache(digest: str, prompt: str) -> None:
    CONTEXT_CACHE_PATH.write_text(json.dumps({"digest": digest, "prompt": prompt}))


async def load_context(config: Config) -> str | None:
    try:
        text = CONTEXT_PATH.read_text().strip()
    except FileNotFoundError:
        return None
    except OSError:
        logger.exception("Could not read context.md")
        return None

    if not text:
        return None

    if SECRET_PATTERN.search(text):
        logger.error("context.md looks like it contains a secret, so it was skipped. Keep secrets in .env")
        return None

    if len(text) > MAX_CHARS:
        logger.warning(f"context.md is over {MAX_CHARS} characters, only the start is used")
        text = text[:MAX_CHARS]

    settings = config.context
    digest = _digest(text, f"{settings.provider}:{settings.model}")
    cache = _read_cache()
    if cache and cache.get("digest") == digest:
        return cache.get("prompt")

    logger.info("context.md changed, regenerating the summary")
    try:
        model = build_model(settings.provider, settings.model, settings.api_key_env)
        agent = Agent(model, instructions=SUMMARY_PROMPT)
        result = await asyncio.wait_for(agent.run(text), 20)
    except Exception:  # noqa: BLE001
        logger.exception("context.md summary failed")
        return cache.get("prompt") if cache else None

    prompt = result.output.strip()
    _write_cache(digest, prompt)
    return prompt
