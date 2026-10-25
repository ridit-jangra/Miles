from pathlib import Path

import requests
from huggingface_hub import snapshot_download
from loguru import logger
from tqdm.auto import tqdm

from miles.config import ProviderSettings, load_config
from miles.plugins import deps
from miles.plugins.loader import plugin_folders
from miles.providers import STT, TTS, build_stt, build_tts

_last_percent: dict[str, int] = {}


STEPS = {"stt": "Speech model", "tts": "Voice model", "plugins": "Plugin dependencies", "server": "Starting server"}


def step(id: str, state: str, fraction: float = 0.0) -> None:
    print(f"MILES_STEP {id}|{STEPS[id]}|{state}|{fraction:.3f}", flush=True)


def progress(id: str, fraction: float) -> None:
    percent = int(fraction * 100)
    if _last_percent.get(id) == percent:
        return
    _last_percent[id] = percent
    step(id, "active", fraction)


def hf_bar(label: str) -> type[tqdm]:
    class Bar(tqdm):
        def update(self, n=1):
            result = super().update(n)
            if self.unit == "B" and self.total and self.total > 10_000_000:
                progress(label, self.n / self.total)
            return result

    return Bar


def fetch(url: str, dest: Path, label: str | None = None) -> None:
    if dest.exists():
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    partial = dest.with_name(dest.name + ".part")
    with requests.get(url, stream=True, timeout=300) as response:
        response.raise_for_status()
        total = int(response.headers.get("content-length", 0))
        done = 0
        with open(partial, "wb") as f:
            for chunk in response.iter_content(chunk_size=1 << 20):
                f.write(chunk)
                done += len(chunk)
                if label and total:
                    progress(label, done / total)
    partial.rename(dest)


def prefetch_whisper(cfg: ProviderSettings) -> None:
    from faster_whisper.utils import _MODELS

    snapshot_download(
        _MODELS.get(cfg.model, cfg.model),
        allow_patterns=["config.json", "preprocessor_config.json", "model.bin", "tokenizer.json", "vocabulary.*"],
        tqdm_class=hf_bar("stt"),
    )


def prefetch_kokoro(cfg: ProviderSettings) -> None:
    from pipecat.services.kokoro.tts import (
        KOKORO_CACHE_DIR,
        KOKORO_MODEL_URL,
        KOKORO_VOICES_URL,
    )

    fetch(KOKORO_MODEL_URL, KOKORO_CACHE_DIR / "kokoro-v1.0.onnx", "tts")
    fetch(KOKORO_VOICES_URL, KOKORO_CACHE_DIR / "voices-v1.0.bin", "tts")


def prefetch_piper(cfg: ProviderSettings) -> None:
    from pipecat.services.piper.tts import PIPER_CACHE_DIR

    region, name, quality = cfg.voice.split("-")
    base = f"https://huggingface.co/rhasspy/piper-voices/resolve/main/{region.split('_')[0]}/{region}/{name}/{quality}/{cfg.voice}"
    fetch(f"{base}.onnx.json?download=true", PIPER_CACHE_DIR / f"{cfg.voice}.onnx.json")
    fetch(f"{base}.onnx?download=true", PIPER_CACHE_DIR / f"{cfg.voice}.onnx", "tts")


PREFETCH = {
    ("stt", "whisper"): prefetch_whisper,
    ("tts", "kokoro"): prefetch_kokoro,
    ("tts", "piper"): prefetch_piper,
}


def pending_plugin_deps(config) -> list:
    if not config.plugins.enabled:
        return []
    return [f for f in plugin_folders() if f.name not in config.plugins.disabled and deps.needs_install(f)]


def download_models() -> None:
    config = load_config()
    pending = pending_plugin_deps(config)
    jobs = [("stt", config.stt, STT, build_stt), ("tts", config.tts, TTS, build_tts)]
    for id, cfg, table, _ in jobs:
        if table[cfg.provider].local:
            step(id, "pending")
    if pending:
        step("plugins", "pending")
    step("server", "pending")
    for id, cfg, table, build in jobs:
        local = table[cfg.provider].local
        if local:
            step(id, "active", -1)
        if prefetch := PREFETCH.get((id, cfg.provider)):
            try:
                prefetch(cfg)
            except Exception as e:  # noqa: BLE001
                logger.warning(f"Could not prefetch the {id} model with progress: {e}")
        build(cfg)
        if local:
            step(id, "done", 1)
    if pending:
        step("plugins", "active", -1)
        for folder in pending:
            deps.install(folder)
        step("plugins", "done", 1)
    step("server", "active", -1)
