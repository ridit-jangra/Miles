import json

from loguru import logger

from miles.env import HOME_DIR

SETTINGS_PATH = HOME_DIR / "settings.json"
DEFAULTS = {"auto_confirm": False}


def load_settings() -> dict:
    try:
        saved = json.loads(SETTINGS_PATH.read_text())
    except (OSError, ValueError):
        return dict(DEFAULTS)
    return {key: saved.get(key, default) for key, default in DEFAULTS.items()}


def save_setting(key: str, value) -> dict:
    settings = {**load_settings(), key: value}
    try:
        SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
        SETTINGS_PATH.write_text(json.dumps(settings, indent=2))
    except OSError:
        logger.exception("Could not save settings")
    return settings
