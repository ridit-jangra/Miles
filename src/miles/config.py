import tomllib
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict

from miles.env import CONFIG_PATH, DEFAULT_CONFIG_PATH


class ProviderSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")
    provider: str
    model: str | None = None
    api_key_env: str | None = None
    options: dict[str, Any] = {}


class LLMSettings(ProviderSettings):
    provider: str = "openrouter"
    model: str | None = "anthropic/claude-haiku-5.5"

class TTSSettings(ProviderSettings):
    provider: str = "piper"
    voice: str | None = "en_US-danny-low"

class STTSettings(ProviderSettings):
    provider: str = "whisper"
    model: str | None = "small"
    device: str = "cpu"
    compute_type: str = "int8"

class AgentsSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")
    provider: str = "openrouter"
    model: str = "anthropic/claude-sonnet-5-5"
    api_key_env: str | None = None

class ContextSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")
    provider: str = "openrouter"
    model: str = "anthropic/claude-haiku-5.5"
    api_key_env: str | None = None

class MemorySettings(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enabled: bool = True
    auto_remember: bool = True
    history_days: int | Literal["never"] = 90
    max_prompt_chars: int = 2000
    max_facts: int = 200

class PluginsSettings(BaseModel):
    enabled: bool = True
    disabled: list[str] = []

class Config(BaseModel):
    llm: LLMSettings = LLMSettings()
    stt: STTSettings = STTSettings()
    tts: TTSSettings = TTSSettings()
    context: ContextSettings = ContextSettings()
    agents: AgentsSettings = AgentsSettings()
    memory: MemorySettings = MemorySettings()
    plugins: PluginsSettings = PluginsSettings()
    plugin_settings: dict[str, dict] = {}


def _read(path: Path) -> dict:
    return tomllib.loads(path.read_text()) if path.exists() else {}

def _merge(base: dict, over: dict) -> dict:
    out = dict(base)
    for key, value in over.items():
        out[key] = _merge(out[key], value) if isinstance(value, dict) and isinstance(out.get(key), dict) else value
    return out

def load_config() -> Config:
    return Config(**_merge(_read(DEFAULT_CONFIG_PATH), _read(CONFIG_PATH)))
