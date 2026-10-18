from pathlib import Path
import tomllib

from pydantic import BaseModel

CONFIG_PATH = Path(__file__).resolve().parents[2] / "config.toml"


class BaseSettings(BaseModel):
    model: str = "anthropic/claude-haiku-5.5"
    voice: str = "en_US-danny-low"

class PluginsSettings(BaseModel):
    enabled: bool = True
    disabled: list[str] = []


class Config(BaseModel):
    miles: BaseSettings = BaseSettings()
    plugins: PluginsSettings = PluginsSettings()
    plugin_settings: dict[str, dict] = {}


def load_config() -> Config:
    if not CONFIG_PATH.exists():
        return Config()
    return Config(**tomllib.loads(CONFIG_PATH.read_text()))
