# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Miles is a voice-agent harness in pure Python on Pipecat ("Jarvis for everyone", very customizable). The Python server is the product; an Electron UI (pipecat-ui) comes later. The old TypeScript version lives in `old/` (gitignored, to be deleted).

## Commands

```fish
uv run src/miles/main.py        # starts the Pipecat dev runner, open http://localhost:7860
uv run ruff check src plugins   # lint (ruff is the only dev dependency)
uv add <pkg>                    # use uv for Python deps; use bun, never npm, for anything JS

cd ui && bun install && ./node_modules/.bin/install-electron   # bun skips Electron's install script, so fetch the binary by hand
cd ui && bun run dev            # Electron window; the Python server must already be running
cd ui && bun run typecheck && bun run build
```

There is no test suite. Behaviour is verified with small throwaway scripts and by talking to the bot. After a session, check for leaked MCP subprocesses with `pgrep -af "[m]cp-server-time"` (the `[m]` stops pgrep matching itself).

Secrets go in `.env` only (`OPENROUTER_API_KEY`, see `.env.example`). Never in `config.toml`, plugin manifests or a future `context.md`.

## Architecture

`main.py` exposes `bot(runner_args)` for Pipecat's runner; `voice/pipeline.py:run()` builds everything per client connection. Read it first. The wiring order matters (several pieces use late-bound closures to break circular dependencies, e.g. `speak` needs `task`, `inform` needs `context`).

**Pipeline:** transport in → Whisper STT → `ConfirmProcessor` → user aggregator (Silero VAD + smart-turn) → OpenRouter LLM → Piper TTS → transport out → assistant aggregator → `ActivityTracker`. The tracker must stay *after* the assistant aggregator (before it causes Anthropic's "assistant message prefill" 400).

**Plugins** (`plugins/<name>/`, loaded by `plugins/loader.py` into a `PluginBundle`): a folder with `plugin.toml` (name, `[permissions]`, `[mcp.*]` servers), `plugin.py` with `register(api)`, and optional `agents/*.md`. `PluginContext` (`plugins/api.py`) gives plugins `@api.tool`, `api.confirm(...)` and `@api.watch(every=...)`. Plugin config comes from `[plugin_settings.<name>]` in the root `config.toml`. Tools are scoped per plugin: an agent only sees its own plugin's tools and MCP servers, plus builtins from `tools/registry.py`.

**Two separate MCP stacks:**
- Miles himself uses Pipecat's `MCPClient` via `McpConnection` (`mcp/connect.py`), only for servers with `miles = true`. `start()` returns immediately; each server arrives in the background and `on_ready` calls `context.set_tools(...)` (Pipecat re-syncs tool handlers on every LLM context frame, so this is safe mid-session). `close()` runs in the pipeline's `finally` and must close clients, including ones still starting.
- Subagents use Pydantic AI `MCPToolset` (`make_toolset`) through `McpPool` (`mcp/pool.py`): servers named in some agent's `mcp: [names]` start once in the background at boot and are shared by all tasks; `TaskManager._run` waits on `pool.toolsets_for(...)`. The stdio transport uses `keep_alive=False` and `init_timeout=30` (fastmcp's default 5s start budget is too short for a cold `uvx`).

**Subagents** (`agents/`): markdown files with YAML frontmatter (`AgentDef`). `TaskManager` runs them as background asyncio tasks through `run_agent` (Pydantic AI + OpenRouter) and calls `on_done`, which injects a developer message and triggers an LLM run. Miles gets `delegate`/`check_task`/`list_tasks`/`cancel_task`. The tool docstrings are the LLM's instructions (e.g. "don't poll check_task"), so edit them with care.

**Confirmations** (`confirm/`, `voice/confirm_processor.py`): a tool never blocks waiting for the user. `Confirmer.request` returns immediately, the LLM asks the question, `ConfirmProcessor` intercepts the next transcript, and a deterministic `parse_answer` decides yes/no. The action runs in code, and the outcome is injected as a developer message *before* the "Yes." transcript is forwarded to the LLM.

**Watchers** (`watchers/`): `Scheduler` runs plugin `@api.watch` functions on timers. They return `Alert`s into the `Inbox` (dedup by key, expiry). `Notifier` delivers by priority (low/normal/urgent) when `ActivityTracker` reports Miles is idle; urgent alerts interrupt. The tracker's "busy" state covers speaking, LLM running, tools running and an expected response.

**Memory** (`memory/`, data in the gitignored `/memory/` folder, settings in `[memory]`): facts are markdown lines in `facts.md` (`FactFile`: dedupe, secret check, size cap), history is SQLite with FTS5 (`MemoryStore`, pruned by `history_days` or kept with `"never"`). Miles gets `remember`/`forget`/`recall` tools (`memory/tools.py`; `forget` goes through the `Confirmer`; at most 5 saves per session; saving is also steered by the Memory section of `prompts/system.md`). `pipeline.py` injects a capped facts block into the system prompt, logs turns from the aggregators' `on_user_turn_stopped`/`on_assistant_turn_stopped` events, and in the background summarizes the previous session (`memory/recap.py`, cached in `last_session.json`) into a developer message. Agents with `memory: true` in their frontmatter get their own notes file (`memory/agents/<name>.md`) in their instructions and a `note` tool.

**Conventions:**
- Tool functions are plain functions or async direct functions, converted by `voice/tools.py:to_pipecat`, which yields once (`await asyncio.sleep(0)`) before returning its result. Without that, when the LLM calls an instant tool in parallel with a slower one (e.g. `remember` + an MCP tool), Pipecat's assistant aggregator sees the instant result before the sibling's in-progress frame, runs the LLM twice, and Miles answers twice. The docstring becomes the tool description, so tools need docstrings, and they must return JSON-serializable values (plain dicts, never dataclasses).
- STT/LLM/TTS come from `[stt]`/`[llm]`/`[tts]` in `config.toml` via `providers.py`: a table of `Spec`s (module, class, API-key env var, pip extra) plus one generic `_build`. Services are imported lazily, extra constructor args go in `options = {...}`, `api_key_env` overrides the key variable, and a provider whose extra isn't installed raises a clear "uv add pipecat-ai[...]" error. Providers needing an aiohttp session are closed by `close_providers()`. To add a provider, add one table row.
- Config is typed in `config.py` (root `config.toml`); `env.py` only holds path constants (`ROOT`, `PLUGINS_DIR`); `.env` is loaded in `main.py`.

## UI

`ui/` is an Electron + React 19 + TypeScript app built with electron-vite and Tailwind v4 (`src/main`, `src/preload`, `src/renderer/src`). Colours, radius, fonts and sizes live in the `@theme` block of `styles.css` (so classes like `bg-panel`, `text-ink-dim`, `rounded-control`, `text-note`, `font-display`); fonts come from `@fontsource-variable/*` imports (JetBrains Mono for headings, Geist, Geist Mono; licences in `ui/THIRD_PARTY.md`), and the components in `components/ui.tsx` carry plain Tailwind utilities. `lib/cn.ts` extends tailwind-merge with the custom `text-note`/`text-ui` sizes (without that, `cn()` treats them as colours and drops them). The background is `components/AsciiField.tsx`: a canvas grid of monospace glyphs (an ordered Bayer dither over drifting noise, cached in a glyph atlas, ~25 fps, static when reduced motion is on). Props: `cell`, `speed`, `strength`. Pages are in `pages/`; `lib/sample.ts` holds example data that the server bridge will replace (panels say "example").

Voice: `lib/voice.tsx` wraps a `PipecatClient` (SmallWebRTC) in a `VoiceProvider` and `useVoice()`. It calls `POST /start` on the Pipecat runner, then posts the offer to `/sessions/<id>/api/offer`. Bot text arrives twice per sentence (`spoken_status` "new" then "completed", different `segment_id`), so `pushBot` drops the repeat. `src/main/server.ts` starts `uv run src/miles/main.py` if nothing answers on :7860 and stops its process group with SIGINT on quit.

Planned server-to-UI state (inbox, tasks, MCP status, memory) goes over Pipecat's UI command channel: `RTVIUICommandFrame` on the Python side, `useUICommandHandler(command, fn)` in React; UI-to-server is `useUIEventSender()` / `RTVIUIEventFrame`. The CLI will live in `src/miles/cli/` (inside the package; a top-level `src/cli` would not be installed).

To look at the UI without a display, serve `ui/out/renderer` with `python3 -m http.server` and drive headless `google-chrome-stable` over the DevTools protocol with a real wait (the Field worker needs wall-clock time, so `--screenshot` and `--virtual-time-budget` capture a black background).

## Working style for this repo

The owner writes the code themselves. Explain, give hints and snippets, review, and run tests. Only write whole features when they explicitly ask ("do it", "write it"). Keep answers short and plain, with a tldr first. Commits are short, human, 1–2 lines.

## Known open items

`pipeline.py` should build services with `providers.build_*` and use `config.llm/stt/tts/agents` instead of `config.miles` (then delete `BaseSettings`); unused `connect_servers` in `mcp/connect.py`; the plugin trust prompt belongs in the future CLI (`miles install <plugin>`: show commands/env names/permissions, store approval keyed by manifest hash, load-time check that the hash still matches); paths (`env.py`) are source-tree relative and must move to user dirs before shipping as a `uv tool`; `researcher` agent's `[mcp.playwright]` block is commented out; the `miles` CLI is not built yet.
