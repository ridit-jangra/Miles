import json
import sys
from collections.abc import Callable
from pathlib import Path

import requests
from huggingface_hub import snapshot_download
from loguru import logger
from tqdm.auto import tqdm

from miles import commands
from miles.config import ProviderSettings, load_config
from miles.plugins import deps, trust
from miles.plugins.loader import plugin_folders
from miles.providers import STT, TTS, build_stt, build_tts

_last_percent: dict[str, int] = {}


STEPS = {"stt": "Speech model", "tts": "Voice model", "plugins": "Plugin dependencies", "server": "Starting server"}


def step(id: str, state: str, fraction: float = 0.0, label: str | None = None) -> None:
    print(f"MILES_STEP {id}|{label or STEPS[id]}|{state}|{fraction:.3f}", flush=True)


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


def unreviewed(config) -> list[Path]:
    if not config.plugins.enabled:
        return []
    return [f for f in plugin_folders() if f.name not in config.plugins.disabled and not trust.trusted(f)]


def ask_in_terminal(folders: list[Path]) -> set[str]:
    approved = set()
    for folder in folders:
        info = trust.describe(folder)
        print(f"\nPlugin {info['name']} ({info['state']}): {info['description']}")
        for dependency in info["dependencies"]:
            print(f"  installs {dependency}")
        for server in info["servers"]:
            print(f"  runs {server['run']}")
        if info["permissions"]:
            print(f"  wants {', '.join(info['permissions'])}")
        if input("  Install it? [y/N] ").strip().lower() == "y":
            approved.add(folder.name)
    return approved


def review_plugins(config) -> None:
    folders = unreviewed(config)
    if not folders:
        return
    if commands.listening:
        print("MILES_REVIEW " + json.dumps([trust.describe(f) for f in folders]), flush=True)
        approved = set(commands.wait_for("approve")["approve"])
        print("MILES_REVIEW []", flush=True)
    elif sys.stdin.isatty():
        approved = ask_in_terminal(folders)
    else:
        logger.warning(f"Skipping plugins that aren't approved yet: {[f.name for f in folders]}")
        return
    for folder in folders:
        if folder.name in approved:
            trust.approve(folder)


def plugin_work(config) -> list[tuple[str, Callable[[], object]]]:
    if not config.plugins.enabled:
        return []
    work = []
    for folder in plugin_folders():
        if folder.name in config.plugins.disabled or not trust.trusted(folder):
            continue
        if deps.needs_install(folder):
            work.append((f"{folder.name}: {', '.join(deps.requirements(folder))}", lambda f=folder: deps.install(f)))
        for name, server in deps.mcp_servers(folder).items():
            if deps.needs_warm(server):
                work.append((f"{folder.name}: {name} server", lambda f=folder, n=name, s=server: deps.warm(f.name, n, s)))
    return work


def download_models() -> None:
    config = load_config()
    review_plugins(config)
    work = plugin_work(config)
    jobs = [("stt", config.stt, STT, build_stt), ("tts", config.tts, TTS, build_tts)]
    for id, cfg, table, _ in jobs:
        if table[cfg.provider].local:
            step(id, "pending")
    if work:
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
    if work:
        for done, (label, job) in enumerate(work):
            step("plugins", "active", done / len(work), label)
            job()
        step("plugins", "done", 1)
    step("server", "active", -1)
