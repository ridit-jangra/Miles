# Echo — Voice AI Assistant

## Project overview

Echo is a local-first, voice-controlled AI desktop assistant. It listens for a wake word, transcribes speech locally via faster-whisper, reasons with an AI agent (Vercel AI SDK + Groq/OpenRouter), and speaks responses back via Piper TTS. Nothing leaves the machine for transcription or synthesis.

It doubles as a coding agent — the AI core has file read/write/edit, bash, grep/glob search, web search/fetch, memory persistence, and MCP-based integrations (Slack, GitHub, Chrome DevTools).

Architecture: **Electron** shell around a **React** renderer, a **Python FastAPI** speech server (localhost:8000), and a **TypeScript agent core** shared between main process and preload.

## Tech stack

| Layer           | Tech                                                      |
| --------------- | --------------------------------------------------------- |
| Shell           | Electron 39, electron-vite 5, electron-builder 26         |
| UI              | React 19, Tailwind CSS v4, Radix UI, three.js             |
| AI              | `ai` (Vercel AI SDK 6), `@ai-sdk/groq`, `@ai-sdk/mcp`     |
| Validation      | Zod 4                                                     |
| Search          | `@vscode/ripgrep`                                         |
| Speech (Python) | FastAPI, faster-whisper, piper-tts, openwakeword, PyAudio |
| Diff            | `diff` 9                                                  |
| Language        | TypeScript 5.9, Python 3.11.9                             |

## Package manager

**bun** — uses `bun.lock`. Install with `bun install`. All scripts use `bun run`.

## Platform

Primary development on **linux**. Also targets Windows (NSIS installer, PowerShell scripts) and macOS (DMG). Linux builds produce AppImage, snap, and deb. CUDA acceleration for NVIDIA GPUs via `nvidia-cublas-cu12` / `nvidia-cudnn-cu12`.

## Build & dev commands

| Command                         | Purpose                                                  |
| ------------------------------- | -------------------------------------------------------- |
| `bun install`                   | Install all deps + postinstall (electron-builder)        |
| `bun run start:client`          | Electron + React with HMR                                |
| `bun run start:server`          | Python FastAPI speech server on port 8000                |
| `bun run build`                 | Typecheck + electron-vite build                          |
| `bun run build:linux`           | Build + package for Linux (AppImage/snap/deb)            |
| `bun run start`                 | Preview built app                                        |
| `bun run typecheck`             | TypeScript check (node + web tsconfigs)                  |
| `bun run lint`                  | ESLint with cache                                        |
| `bun run format`                | Prettier --write                                         |
| `bun run download-models:linux` | Download Piper voice, Whisper small, OpenWakeWord models |

## Project structure

```
src/
├── main/           # Electron main process — window lifecycle + IPC handlers
│   └── ipc/        # ai, stt, tts, mcp, oauth, briefing handlers
├── preload/        # contextBridge — exposes typed APIs to renderer
├── renderer/       # React 19 UI — Mic, Sidebar, Integrations, PixlBlast
│   └── src/
│       ├── components/  # Mic.tsx, Sidebar.tsx, PixlBlast.tsx, etc.
│       └── lib/         # cn(), integration catalog, wake greeting
├── shared/         # IPC channels, constants, type definitions
└── core/           # AI agent core + Python server
    ├── ai/         # chat(), tools (14 tools), session, compaction, system prompt
    ├── mcp/        # MCP manager + JSON store
    ├── oauth/      # GitHub device OAuth, Slack OAuth
    ├── briefing/   # Daily briefing logic
    └── server/     # FastAPI speech server (server.py)
scripts/            # Shell scripts for server start + model download
models/             # ONNX models (wake word, Piper voice, Whisper)
```

## Code style

- **Quotes**: single, **semicolons**: none, **print width**: 100, **indent**: 2 spaces
- **Line endings**: LF, **charset**: UTF-8
- **Formatter**: Prettier (`.prettierrc.yaml`), **Linter**: ESLint flat config with TS + React plugins
- **Imports**: named imports, barrel patterns via `index.ts`, one path alias `@renderer` → `src/renderer/src`
- **Naming**: camelCase functions/vars, PascalCase components/classes/tools, SCREAMING_SNAKE IPC channels
- **Error handling**: try/catch → `{ success: false, error: "..." }` return objects; IPC handlers catch and return gracefully
- **TypeScript**: two tsconfigs (node + web), composite mode, `react-jsx`, strict via `@electron-toolkit/tsconfig`

## Architecture notes

- **Process separation**: Main ↔ Preload (contextBridge) ↔ Renderer, plus separate Python server on :8000
- **Data flow**: Mic → MediaRecorder → `/transcribe` (Python) → AI Agent (Groq) → `/speak` (Python) → Web Audio API
- **Tool pattern**: each tool is a folder with `tool.ts` (Zod schema + `tool()`) and `prompt.ts` (description)
- **Singleton**: `MCPManager`, `PersistentShell` — one instance per process
- **Session persistence**: messages → `~/.echo/sessions/`, memory → `~/.echo/memory/`, user profile → `~/.echo/user`
- **Compaction**: automatic summarization when tokens exceed threshold
- **Permissions**: tools request user permission before executing destructive operations
- **MCP**: stdio + HTTP transport for Slack, GitHub, Chrome DevTools integrations
- **No AI context files** (Cursor rules, Copilot instructions, etc.) exist — agent behavior is entirely in `systemPrompt.ts`
