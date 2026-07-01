import os
import time
import io
import wave
import asyncio
import threading

import numpy as np
import pyaudio
from scipy.signal import resample_poly
from fastapi import FastAPI, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from faster_whisper import WhisperModel
from faster_whisper.audio import decode_audio
from piper.voice import PiperVoice
from openwakeword.model import Model
from sanitize import sanitize_for_tts

os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["HF_DATASETS_OFFLINE"] = "1"

app = FastAPI()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.environ.get("ECHO_MODELS_DIR") or os.path.normpath(
    os.path.join(BASE_DIR, "../../../models")
)


def _whisper_source(name: str) -> str:
    local = os.path.join(MODELS_DIR, "whisper", name)
    return local if os.path.isdir(local) else name


def load_stt() -> WhisperModel:
    candidates = [
        ("small.en", "cuda", "float16"),
        ("small", "cpu", "int8"),
    ]
    for name, device, compute in candidates:
        source = _whisper_source(name)
        try:
            m = WhisperModel(source, device=device, compute_type=compute)
            # Constructing the model doesn't touch cuBLAS/cuDNN — those load
            # lazily on the first encode. Force a tiny inference now so a
            # missing/unloadable GPU lib falls back to the next candidate here,
            # instead of 500-ing on the user's first real utterance.
            warmup = np.random.randn(16000).astype(np.float32) * 1e-3
            list(m.transcribe(warmup, beam_size=1)[0])
            print(f"STT: Running {name} on {device} ({compute}) from {source}")
            return m
        except Exception as e:
            print(f"STT: {name} on {device} unavailable ({e})")
    raise RuntimeError("STT: no Whisper model could be loaded")


stt_model = load_stt()

DANNY_MODEL = os.path.join(MODELS_DIR, "en_US-danny-low.onnx")

DEFAULT_VOICE = "en_US-danny-low"
VOICES = {DEFAULT_VOICE: PiperVoice.load(DANNY_MODEL)}
tts = VOICES[DEFAULT_VOICE]
print("TTS: Piper danny loaded")

oww_model = Model(
    wakeword_models=[os.path.join(MODELS_DIR, "wakeup.onnx")],
    inference_framework="onnx",
)
print("Wake word: OpenWakeWord loaded")

CHUNK = 1280
RATE = 16000

IN_RATE = 48000
IN_CHUNK = CHUNK * IN_RATE // RATE  # 3840 frames -> 1280 after resample
WAKE_COOLDOWN = 3.0
WAKE_SCORE_THRESHOLD = float(os.environ.get("WAKE_SCORE_THRESHOLD", "0.15"))
WAKE_DEBUG = os.environ.get("WAKE_DEBUG", "") not in ("", "0", "false")

WAKE_INPUT_DEVICE = os.environ.get("WAKE_INPUT_DEVICE", "pulse")

last_wake_time: float = 0.0
wake_clients: list[WebSocket] = []


async def notify_wake(source: str = "wakeword") -> None:
    dead: list[WebSocket] = []
    for client in wake_clients:
        try:
            await client.send_text("wake")
        except Exception:
            dead.append(client)
    for client in dead:
        if client in wake_clients:
            wake_clients.remove(client)


def mic_loop(loop: asyncio.AbstractEventLoop) -> None:
    global last_wake_time

    pa = pyaudio.PyAudio()

    device_index = None
    if WAKE_INPUT_DEVICE:
        for i in range(pa.get_device_count()):
            info = pa.get_device_info_by_index(i)
            if (
                info.get("maxInputChannels", 0) > 0
                and info["name"] == WAKE_INPUT_DEVICE
            ):
                device_index = i
                break
        if device_index is None:
            print(
                f"Wake word: input device '{WAKE_INPUT_DEVICE}' not found, using system default"
            )

    stream = pa.open(
        rate=IN_RATE,
        channels=1,
        format=pyaudio.paInt16,
        input=True,
        input_device_index=device_index,
        frames_per_buffer=IN_CHUNK,
    )
    print(f"Wake word: listening... (device={WAKE_INPUT_DEVICE or 'default'})")

    while True:
        raw = np.frombuffer(
            stream.read(IN_CHUNK, exception_on_overflow=False), dtype=np.int16
        )

        pcm = resample_poly(raw.astype(np.float32), RATE, IN_RATE).astype(np.int16)
        prediction = oww_model.predict(pcm)
        for model_name, score in prediction.items():
            if WAKE_DEBUG and score > 0.05:
                print(f"[wake debug] {model_name}: {score:.3f}")
            if score > WAKE_SCORE_THRESHOLD:
                now = time.time()
                if now - last_wake_time < WAKE_COOLDOWN:
                    continue
                last_wake_time = now
                print(f"Wake word detected! ({model_name}: {score:.2f})")
                asyncio.run_coroutine_threadsafe(notify_wake("wakeword"), loop)


@app.on_event("startup")
async def startup() -> None:
    loop = asyncio.get_event_loop()
    t = threading.Thread(target=mic_loop, args=(loop,), daemon=True)
    t.start()


@app.websocket("/wake")
async def wake_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    wake_clients.append(websocket)
    try:
        while True:
            await asyncio.sleep(15)
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        if websocket in wake_clients:
            wake_clients.remove(websocket)


def analyze_tone(samples: np.ndarray, words: list) -> str:
    if samples.size == 0:
        return "neutral"

    rms = float(np.sqrt(np.mean(samples**2)))

    rate = 0.0
    if len(words) >= 2:
        span = max(words[-1].end - words[0].start, 1e-3)
        rate = len(words) / span

    loud = rms > 0.08
    quiet = rms < 0.02
    fast = rate > 3.2
    slow = 0.0 < rate < 1.8

    if loud and fast:
        return "excited"
    if loud:
        return "emphatic"
    if quiet and slow:
        return "subdued"
    if fast:
        return "rushed"
    if slow:
        return "hesitant"
    return "neutral"


@app.post("/transcribe")
async def transcribe(file: UploadFile):
    data = await file.read()
    segments, _ = stt_model.transcribe(
        io.BytesIO(data),
        language="en",
        beam_size=1,
        vad_filter=True,
        condition_on_previous_text=False,
        word_timestamps=True,
    )
    seg_list = list(segments)
    text = " ".join([s.text.strip() for s in seg_list])
    words = [w for s in seg_list for w in (s.words or [])]

    try:
        samples = decode_audio(io.BytesIO(data), sampling_rate=RATE)
    except Exception:
        samples = np.array([], dtype=np.float32)

    tone = analyze_tone(samples, words)
    return {"text": text, "tone": tone}


@app.post("/speak")
async def speak(body: dict):
    text = sanitize_for_tts(body.get("text", ""))
    voice = VOICES.get(body.get("voice", DEFAULT_VOICE), tts)

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav_file:
        if not text:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(voice.config.sample_rate)
        else:
            voice.synthesize_wav(text, wav_file)

    buf.seek(0)
    return StreamingResponse(buf, media_type="audio/wav")


@app.get("/voices")
async def voices():
    return {
        "voices": [
            {
                "id": "en_US-danny-low",
                "name": "Danny",
                "language": "en-US",
                "gender": "male",
            }
        ]
    }


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    host = os.environ.get("ECHO_SERVER_HOST", "127.0.0.1")
    port = int(os.environ.get("ECHO_SERVER_PORT", "8000"))
    uvicorn.run(app, host=host, port=port, log_level="info")
