# Echo

Echo is a voice assistant that chats with you like a partner and helps ou achieve goals and using integrations can help you get info about other things without doing anything

---

## Features

- **Hands-free wake** — custom on-device wake word (OpenWakeWord), with cooldown and tunable sensitivity.
- **Local speech pipeline** — speech-to-text with [faster-whisper](https://github.com/SYSTRAN/faster-whisper) (GPU when available, CPU fallback) and text-to-speech with [Piper](https://github.com/rhasspy/piper). No audio leaves your machine for transcription or synthesis.
- **Agentic AI core** — a agent (via the [Vercel AI SDK](https://sdk.vercel.ai)) with file read/write/edit, shell, ripgrep/glob search, web search & fetch, sub-agent delegation, and session compaction.
- **Skills & persistent memory** — loadable skills plus per-user and per-project memory stored under `~/.echo`, so Echo remembers what matters across sessions.
- **MCP integrations** — connect external tools through the Model Context Protocol. Built-in catalog includes **Slack**, **GitHub** (OAuth), and **Chrome DevTools** (browser automation).
- **Voice-tuned responses** — the assistant is prompted for short, spoken-style replies (no markdown read aloud) for a natural conversation feel.

## Architecture

Echo runs as two cooperating processes:

```
┌───────────────────────────── Electron app ─────────────────────────────┐
│                                                                         │
│  Renderer (React + Tailwind + three.js)   ◄── IPC ──►   Main process    │
│   • Mic, integrations, sidebar                  • AI agent     │
│                                                          • MCP manager  │
│                                                          • OAuth, TTS/STT│
│                                                            IPC bridges   │
└───────────────────────────────────┬─────────────────────────────────────┘
                                     │ HTTP + WebSocket (127.0.0.1:8000)
                       ┌─────────────▼──────────────┐
                       │   Python FastAPI server     │
                       │   • /wake  (wake word)       │
                       │   • /transcribe (Whisper)    │
                       │   • /speak (Piper TTS)       │
                       └──────────────────────────────┘
```

| Layer         | Stack                                                                  |
| ------------- | ---------------------------------------------------------------------- |
| Desktop shell | Electron, electron-vite, electron-builder                              |
| UI            | React, Tailwind CSS, Radix UI, three.js + postprocessing               |
| AI            | Vercel AI SDK, `@ai-sdk/mcp`, Zod                                      |
| Speech server | Python, FastAPI, Uvicorn, faster-whisper, Piper, OpenWakeWord, PyAudio |

### Project layout

```
src/
├── main/            Electron main process + IPC handlers (ai, mcp, oauth, tts, stt, …)
├── preload/         Context-isolated bridge to the renderer
├── renderer/        React UI (Mic, Sidebar, Integrations) + libs
├── shared/          Types shared across processes (mcp, oauth, briefing, channels)
└── core/
    ├── ai/          Agent: tools, skills, prompts, sessions, compaction
    ├── mcp/         MCP server manager + store
    ├── oauth/       GitHub & Slack OAuth flows
    ├── briefing/    Daily briefing generation
    └── server/      Python FastAPI speech server (server.py, sanitize.py)
scripts/             Setup, model download, and server-start scripts
models/              ONNX models (wake word, Piper voice) — downloaded on setup
```

## Prerequisites

- **Node.js** 18+ and a package manager ([Bun](https://bun.sh) is used here; npm works too)
- **Python** 3.11 (see `.python-version`) with a virtual environment at `.venv`
- **PortAudio** for microphone capture (PyAudio dependency)
- A **Groq API key** for the AI agent
- _Optional:_ NVIDIA GPU + CUDA libraries for faster Whisper (CPU int8 fallback otherwise)

## Getting started

### 1. Install dependencies

```bash
bun install            # or: npm install

python -m venv .venv
.venv/bin/pip install -r requirements.txt
```

### 2. Download the speech models

Fetches the Piper voice, Whisper small model, and OpenWakeWord models into `models/` and the HF cache.

```bash
npm run download-models:linux      # Linux / macOS
npm run download-models:win        # Windows (PowerShell)
```

> **Custom wake word:** a custom pretrained custom model is already placed at `models/echo.onnx`. You can train yout custom wake words and use [OpenWakeWord Colab notebook](https://github.com/dscripka/openWakeWord).

### 3. Configure environment

Create a `.env` in the project root:

```dotenv
OPENROUTER_API_KEY=your_openrouter_key_here
GITHUB_CLIENT_ID=for_integrations...fallback_id_is_already_placed
SLACK_CLIENT_ID=for_integrations
SLACK_CLIENT_SECRET=for_integrations
# Optional wake tuning:
# WAKE_SCORE_THRESHOLD=0.15
# WAKE_INPUT_DEVICE=pulse
```

### 4. Run in development

Run the speech server and the desktop client in two terminals:

```bash
npm run start:server     # Python FastAPI on 127.0.0.1:8000 (start:server:win on Windows)
npm run start:client     # Electron + React with HMR
```

## Usage

1. Say the wake word to start a turn.
2. Speak naturally. Echo transcribes, the agent reasons and acts, and the reply is spoken back.
3. Open **Integrations** in the sidebar to connect Slack, GitHub, or Chrome DevTools.

Runtime state lives in `~/.echo/` — user profile, memory, sessions, MCP config, and briefing state.

## Scripts

| Command                                  | Description                                   |
| ---------------------------------------- | --------------------------------------------- |
| `npm run start:client`                   | Electron app with hot reload                  |
| `npm run start:server`                   | Python speech server (with `--reload`)        |
| `npm run build`                          | Type-check + build the app                    |
| `npm run build:linux` / `:win` / `:mac`  | Package a distributable with electron-builder |
| `npm run typecheck`                      | Type-check node + web configs                 |
| `npm run lint` / `npm run format`        | ESLint / Prettier                             |
| `npm run download-models:linux` / `:win` | Download speech models                        |

## Configuration reference

Common environment variables read by the speech server (`src/core/server/server.py`):

| Variable                    | Default | Purpose                        |
| --------------------------- | ------- | ------------------------------ |
| `WAKE_SCORE_THRESHOLD`      | `0.15`  | Wake-word confidence threshold |
| `WAKE_INPUT_DEVICE`         | `pulse` | Input device name for capture  |
| `WAKE_COOLDOWN`             | `3.0`   | Seconds between wake triggers  |
| `WAKE_DEBUG`                | off     | Verbose detection logging      |

## License

[MIT](./LICENSE.txt)
