import importlib
import os
from dataclasses import dataclass
from typing import Any

import aiohttp

from miles.config import LLMSettings, ProviderSettings, STTSettings, TTSSettings


@dataclass(frozen=True)
class Spec:
    module: str
    cls: str
    key: str | None = None
    extra: str | None = None
    session: bool = False
    pass_cfg: tuple[str, ...] = ()
    local: bool = False


def _table(kind: str, rows: dict[str, tuple]) -> dict[str, Spec]:
    return {name: Spec(f"{folder}.{kind}", cls, *rest) for name, (folder, cls, *rest) in rows.items()}


STT = _table("stt", {
    "whisper": ("whisper", "WhisperSTTService", None, "whisper", False, ("device", "compute_type"), True),
    "moonshine": ("moonshine", "MoonshineSTTService", None, "moonshine", False, (), True),
    "funasr": ("funasr", "FunASRSTTService", None, "funasr", False, (), True),
    "assemblyai": ("assemblyai", "AssemblyAISTTService", "ASSEMBLYAI_API_KEY"),
    "aws": ("aws", "AWSTranscribeSTTService", None, "aws"),
    "azure": ("azure", "AzureSTTService", "AZURE_SPEECH_API_KEY", "azure"),
    "cartesia": ("cartesia", "CartesiaSTTService", "CARTESIA_API_KEY"),
    "deepgram": ("deepgram", "DeepgramSTTService", "DEEPGRAM_API_KEY", "deepgram"),
    "elevenlabs": ("elevenlabs", "ElevenLabsRealtimeSTTService", "ELEVENLABS_API_KEY"),
    "fal": ("fal", "FalSTTService", "FAL_KEY"),
    "gladia": ("gladia", "GladiaSTTService", "GLADIA_API_KEY"),
    "google": ("google", "GoogleSTTService", None, "google"),
    "gradium": ("gradium", "GradiumSTTService", "GRADIUM_API_KEY"),
    "groq": ("groq", "GroqSTTService", "GROQ_API_KEY", "groq"),
    "meta": ("meta", "MetaSTTService", "META_API_KEY"),
    "mistral": ("mistral", "MistralSTTService", "MISTRAL_API_KEY", "mistral"),
    "nvidia": ("nvidia", "NvidiaSTTService", "NVIDIA_API_KEY", "nvidia"),
    "openai": ("openai", "OpenAISTTService", "OPENAI_API_KEY"),
    "sarvam": ("sarvam", "SarvamSTTService", "SARVAM_API_KEY", "sarvam"),
    "soniox": ("soniox", "SonioxSTTService", "SONIOX_API_KEY"),
    "speechmatics": ("speechmatics", "SpeechmaticsSTTService", "SPEECHMATICS_API_KEY", "speechmatics"),
    "together": ("together", "TogetherSTTService", "TOGETHER_API_KEY"),
    "xai": ("xai", "XAISTTService", "XAI_API_KEY"),
})

LLM = _table("llm", {
    "openrouter": ("openrouter", "OpenRouterLLMService", "OPENROUTER_API_KEY"),
    "anthropic": ("anthropic", "AnthropicLLMService", "ANTHROPIC_API_KEY", "anthropic"),
    "openai": ("openai", "OpenAILLMService", "OPENAI_API_KEY"),
    "google": ("google", "GoogleLLMService", "GOOGLE_API_KEY", "google"),
    "aws": ("aws", "AWSBedrockLLMService", None, "aws"),
    "azure": ("azure", "AzureLLMService", "AZURE_OPENAI_API_KEY", "azure"),
    "baseten": ("baseten", "BasetenLLMService", "BASETEN_API_KEY"),
    "cerebras": ("cerebras", "CerebrasLLMService", "CEREBRAS_API_KEY"),
    "crusoe": ("crusoe", "CrusoeLLMService", "CRUSOE_API_KEY"),
    "deepseek": ("deepseek", "DeepSeekLLMService", "DEEPSEEK_API_KEY"),
    "fireworks": ("fireworks", "FireworksLLMService", "FIREWORKS_API_KEY"),
    "grok": ("xai", "GrokLLMService", "XAI_API_KEY"),
    "groq": ("groq", "GroqLLMService", "GROQ_API_KEY", "groq"),
    "inception": ("inception", "InceptionLLMService", "INCEPTION_API_KEY"),
    "mistral": ("mistral", "MistralLLMService", "MISTRAL_API_KEY", "mistral"),
    "nebius": ("nebius", "NebiusLLMService", "NEBIUS_API_KEY"),
    "novita": ("novita", "NovitaLLMService", "NOVITA_API_KEY"),
    "nvidia": ("nvidia", "NvidiaLLMService", "NVIDIA_API_KEY", "nvidia"),
    "ollama": ("ollama", "OLLamaLLMService"),
    "perplexity": ("perplexity", "PerplexityLLMService", "PERPLEXITY_API_KEY"),
    "qwen": ("qwen", "QwenLLMService", "QWEN_API_KEY"),
    "sambanova": ("sambanova", "SambaNovaLLMService", "SAMBANOVA_API_KEY"),
    "sarvam": ("sarvam", "SarvamLLMService", "SARVAM_API_KEY", "sarvam"),
    "together": ("together", "TogetherLLMService", "TOGETHER_API_KEY"),
})
LLM["openai-responses"] = Spec("openai.responses.llm", "OpenAIResponsesLLMService", "OPENAI_API_KEY")

TTS = _table("tts", {
    "piper": ("piper", "PiperTTSService", None, "piper", False, (), True),
    "kokoro": ("kokoro", "KokoroTTSService", None, "kokoro", False, (), True),
    "pocket-tts": ("pocket_tts", "PocketTTSService", None, "pocket-tts", False, (), True),
    "xtts": ("xtts", "XTTSService", None, None, True),
    "asyncai": ("asyncai", "AsyncAITTSService", "ASYNCAI_API_KEY"),
    "aws": ("aws", "AWSPollyTTSService", None, "aws"),
    "azure": ("azure", "AzureTTSService", "AZURE_SPEECH_API_KEY", "azure"),
    "bland": ("bland", "BlandTTSService", "BLAND_API_KEY"),
    "camb": ("camb", "CambTTSService", "CAMB_API_KEY", "camb"),
    "cartesia": ("cartesia", "CartesiaTTSService", "CARTESIA_API_KEY"),
    "deepgram": ("deepgram", "DeepgramTTSService", "DEEPGRAM_API_KEY", "deepgram"),
    "elevenlabs": ("elevenlabs", "ElevenLabsTTSService", "ELEVENLABS_API_KEY"),
    "fish": ("fish", "FishAudioTTSService", "FISH_API_KEY", "fish"),
    "google": ("google", "GoogleTTSService", None, "google"),
    "gradium": ("gradium", "GradiumTTSService", "GRADIUM_API_KEY"),
    "groq": ("groq", "GroqTTSService", "GROQ_API_KEY", "groq"),
    "hume": ("hume", "HumeTTSService", "HUME_API_KEY", "hume"),
    "inworld": ("inworld", "InworldTTSService", "INWORLD_API_KEY"),
    "minimax": ("minimax", "MiniMaxHttpTTSService", "MINIMAX_API_KEY", None, True),
    "mistral": ("mistral", "MistralTTSService", "MISTRAL_API_KEY", "mistral"),
    "neuphonic": ("neuphonic", "NeuphonicTTSService", "NEUPHONIC_API_KEY"),
    "nvidia": ("nvidia", "NvidiaTTSService", "NVIDIA_API_KEY", "nvidia"),
    "openai": ("openai", "OpenAITTSService", "OPENAI_API_KEY"),
    "resemble": ("resembleai", "ResembleAITTSService", "RESEMBLE_API_KEY"),
    "rime": ("rime", "RimeTTSService", "RIME_API_KEY"),
    "sarvam": ("sarvam", "SarvamTTSService", "SARVAM_API_KEY", "sarvam"),
    "smallest": ("smallest", "SmallestTTSService", "SMALLEST_API_KEY"),
    "soniox": ("soniox", "SonioxTTSService", "SONIOX_API_KEY"),
    "speechify": ("speechify", "SpeechifyHttpTTSService", "SPEECHIFY_API_KEY", None, True),
    "speechmatics": ("speechmatics", "SpeechmaticsTTSService", "SPEECHMATICS_API_KEY", "speechmatics"),
    "together": ("together", "TogetherTTSService", "TOGETHER_API_KEY"),
    "xai": ("xai", "XAITTSService", "XAI_API_KEY"),
})

_sessions: list[aiohttp.ClientSession] = []


async def close_providers() -> None:
    for session in _sessions:
        await session.close()
    _sessions.clear()


def _whisper_model(name: str):
    from pipecat.services.whisper.stt import Model

    for lookup in (lambda: Model(name), lambda: Model[name.upper().replace("-", "_")]):
        try:
            return lookup()
        except (ValueError, KeyError):
            pass
    raise ValueError(f"Unknown Whisper model {name!r}; choose from: {[m.value for m in Model]}")


MODEL_MAPS = {"whisper": _whisper_model}


def _build(kind: str, table: dict[str, Spec], cfg: ProviderSettings, **settings: Any):
    spec = table.get(cfg.provider)
    if spec is None:
        raise ValueError(f"Unknown {kind} provider {cfg.provider!r}; choose from: {sorted(table)}")

    try:
        cls = getattr(importlib.import_module(f"pipecat.services.{spec.module}"), spec.cls)
    except ImportError as e:
        hint = f' Install it with: uv add "pipecat-ai[{spec.extra}]"' if spec.extra else f" ({e})"
        raise ValueError(f"The {kind} provider {cfg.provider!r} is not installed.{hint}") from e

    kwargs: dict[str, Any] = dict(cfg.options)

    if spec.key:
        env = cfg.api_key_env or spec.key
        if not os.getenv(env):
            raise ValueError(f"The {kind} provider {cfg.provider!r} needs {env} in your .env file")
        kwargs["api_key"] = os.environ[env]

    if spec.session:
        session = aiohttp.ClientSession()
        _sessions.append(session)
        kwargs["aiohttp_session"] = session

    for attr in spec.pass_cfg:
        kwargs[attr] = getattr(cfg, attr)

    model = getattr(cfg, "model", None)
    if model:
        to_value = MODEL_MAPS.get(cfg.provider, lambda m: m)
        settings["model"] = to_value(model)
    voice = getattr(cfg, "voice", None)
    if voice:
        settings["voice"] = voice

    return cls(settings=cls.Settings(**settings), **kwargs)


def build_stt(cfg: STTSettings):
    return _build("STT", STT, cfg)


def build_llm(cfg: LLMSettings, system_prompt: str):
    return _build("LLM", LLM, cfg, system_instruction=system_prompt)


def build_tts(cfg: TTSSettings):
    return _build("TTS", TTS, cfg)
