import tomllib
from typing import Any

from miles.env import CONFIG_PATH
from pydantic import BaseModel, ConfigDict


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

    model: str = "anthropic/claude-sonnet-5-5"

class PluginsSettings(BaseModel):
    enabled: bool = True
    disabled: list[str] = []

class Config(BaseModel):
    llm: LLMSettings = LLMSettings()
    stt: STTSettings = STTSettings()
    tts: TTSSettings = TTSSettings()
    agents: AgentsSettings = AgentsSettings()
    plugins: PluginsSettings = PluginsSettings()
    plugin_settings: dict[str, dict] = {}


def load_config() -> Config:
    if not CONFIG_PATH.exists():
        return Config()
    return Config(**tomllib.loads(CONFIG_PATH.read_text()))
