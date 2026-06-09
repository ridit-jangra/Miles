import os

os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["HF_DATASETS_OFFLINE"] = "1"

from fastapi import FastAPI, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from faster_whisper import WhisperModel
from kokoro_onnx import Kokoro
import tempfile, os, io, soundfile as sf
import numpy as np
import asyncio
import pyaudio
import openwakeword
from openwakeword.model import Model

app = FastAPI()


stt_model = WhisperModel("base", device="cpu", compute_type="int8")
print("STT: Running on CPU")


tts = Kokoro("../../models/kokoro-v1.0.onnx", "../../models/voices-v1.0.bin")
print("TTS: Kokoro loaded")

oww_model = Model(wakeword_models=["hey_jarvis"], inference_framework="onnx")
print("Wake word: OpenWakeWord loaded")

CHUNK = 1280
RATE = 16000


wake_clients: list[WebSocket] = []


async def notify_wake():
    for client in wake_clients:
        try:
            await client.send_text("wake")
        except:
            pass


def mic_loop(loop: asyncio.AbstractEventLoop):
    pa = pyaudio.PyAudio()
    stream = pa.open(
        rate=RATE,
        channels=1,
        format=pyaudio.paInt16,
        input=True,
        frames_per_buffer=CHUNK,
    )
    print("Wake word: listening...")
    while True:
        pcm = np.frombuffer(
            stream.read(CHUNK, exception_on_overflow=False), dtype=np.int16
        )
        prediction = oww_model.predict(pcm)
        for model_name, score in prediction.items():
            if score > 0.5:
                print(f"Wake word detected! ({model_name}: {score:.2f})")
                asyncio.run_coroutine_threadsafe(notify_wake(), loop)


@app.on_event("startup")
async def startup():
    loop = asyncio.get_event_loop()
    import threading

    t = threading.Thread(target=mic_loop, args=(loop,), daemon=True)
    t.start()


@app.websocket("/wake")
async def wake_endpoint(websocket: WebSocket):
    await websocket.accept()
    wake_clients.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        wake_clients.remove(websocket)


@app.post("/transcribe")
async def transcribe(file: UploadFile):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    segments, _ = stt_model.transcribe(tmp_path)
    text = " ".join([s.text.strip() for s in segments])
    os.unlink(tmp_path)
    return {"text": text}


@app.post("/speak")
async def speak(body: dict):
    text = body.get("text", "")
    voice = body.get("voice", "am_michael")

    samples, sample_rate = tts.create(text, voice=voice, speed=1.0, lang="en-us")

    buf = io.BytesIO()
    sf.write(buf, samples, sample_rate, format="WAV")
    buf.seek(0)

    return StreamingResponse(buf, media_type="audio/wav")


@app.get("/health")
async def health():
    return {"status": "ok"}
