from fastapi import FastAPI, UploadFile
from fastapi.responses import StreamingResponse
from faster_whisper import WhisperModel
from kokoro_onnx import Kokoro
import tempfile, os, io, soundfile as sf
import numpy as np

app = FastAPI()

## Speech to text model loading
stt_model = WhisperModel("base", device="cpu", compute_type="int8")
print("STT: Running on CPU")

## Text to speech model loading
tts = Kokoro("kokoro-v1.0.onnx", "voices-v1.0.bin")
print("TTS: Kokoro loaded")


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