import getpass
import json
import os
import sys

import httpx
from dotenv import set_key
from loguru import logger

from miles import commands
from miles.env import ENV_PATH
from miles.providers import LLM, STT, TTS

CHECKS = {
    "openrouter": "https://openrouter.ai/api/v1/auth/key",
    "openai": "https://api.openai.com/v1/models",
    "anthropic": "https://api.anthropic.com/v1/models",
    "groq": "https://api.groq.com/openai/v1/models",
    "deepseek": "https://api.deepseek.com/models",
    "mistral": "https://api.mistral.ai/v1/models",
}
LABELS = {"LLM": "Language model", "STT": "Speech-to-text", "TTS": "Voice"}
TRIES = 3


def check_key(provider: str, key: str, client: httpx.Client | None = None) -> str | None:
    url = CHECKS.get(provider)
    if not url:
        return None
    headers = {"x-api-key": key, "anthropic-version": "2023-06-01"} if provider == "anthropic" else {"Authorization": f"Bearer {key}"}
    try:
        response = (client or httpx).get(url, headers=headers, timeout=10)
    except httpx.HTTPError:
        return None
    if response.status_code in (401, 403):
        return f"{provider} didn't accept that key."
    return None


def missing_keys(config) -> list[dict]:
    wanted: dict[str, dict] = {}
    for kind, cfg, table in (("LLM", config.llm, LLM), ("STT", config.stt, STT), ("TTS", config.tts, TTS)):
        spec = table.get(cfg.provider)
        if spec is None or not spec.key:
            continue
        names = [cfg.api_key_env] if cfg.api_key_env else [f"{kind}_API_KEY", spec.key]
        if any(os.getenv(n) for n in names):
            continue
        wanted.setdefault(
            names[0],
            {"name": names[0], "provider": cfg.provider, "label": f"{LABELS[kind]} key ({cfg.provider})", "secret": True},
        )
    custom = config.agents.api_key_env
    if custom and not os.getenv(custom):
        wanted.setdefault(custom, {"name": custom, "provider": config.agents.provider, "label": f"Subagent key ({config.agents.provider})", "secret": True})
    return list(wanted.values())


def save_key(name: str, value: str) -> None:
    ENV_PATH.parent.mkdir(parents=True, exist_ok=True)
    set_key(str(ENV_PATH), name, value, quote_mode="never")
    os.chmod(ENV_PATH, 0o600)
    os.environ[name] = value


def ask_in_app(needed: list[dict]) -> None:
    error = None
    for _ in range(TRIES):
        print("MILES_ASK " + json.dumps({"fields": needed, "error": error}), flush=True)
        answer = commands.wait_for("answer")["answer"]
        if not answer:
            break
        problems = {}
        for item in needed:
            value = (answer.get(item["name"]) or "").strip()
            if not value:
                continue
            problem = check_key(item["provider"], value)
            if problem:
                problems[item["name"]] = problem
            else:
                save_key(item["name"], value)
        if not problems:
            break
        needed = [item for item in needed if item["name"] in problems]
        error = " ".join(problems.values())
    print("MILES_ASK null", flush=True)


def ask_in_terminal(needed: list[dict]) -> None:
    for item in needed:
        while True:
            value = getpass.getpass(f"{item['label']} (leave empty to skip): ").strip()
            if not value:
                break
            problem = check_key(item["provider"], value)
            if problem:
                print(problem)
                continue
            save_key(item["name"], value)
            break


def ensure_keys(config) -> None:
    needed = missing_keys(config)
    if not needed:
        return
    if commands.listening:
        ask_in_app(needed)
    elif sys.stdin.isatty():
        ask_in_terminal(needed)
    else:
        logger.warning(f"Missing API keys, add them to {ENV_PATH}: {[item['name'] for item in needed]}")
