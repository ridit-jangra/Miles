# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Miles is a voice-agent harness in pure Python on Pipecat ("Jarvis for everyone", very customizable). The Python server is the product; an Electron UI (pipecat-ui) comes later. The old TypeScript version lives in `old/` (gitignored, to be deleted).

## Commands

```fish
uv run src/miles/main.py        # starts the Pipecat dev runner, open http://localhost:7860
uv run ruff check src plugins   # lint (ruff is the only dev dependency)
uv add <pkg>                    # use uv for Python deps; use bun, never npm, for anything JS
```

There is no test suite. Behaviour is verified with small throwaway scripts and by talking to the bot. After a session, check for leaked MCP subprocesses with `pgrep -af "[m]cp-server-time"` (the `[m]` stops pgrep matching itself).

Secrets go in `.env` only (`OPENROUTER_API_KEY`, see `.env.example`). Never in `config.toml`, plugin manifests or a future `context.md`.

## Architecture

`main.py` exposes `bot(runner_args)` for Pipecat's runner; `voice/pipeline.py:run()` builds everything per client connection. Read it first. The wiring order matters (several pieces use late-bound closures to break circular dependencies, e.g. `speak` needs `task`, `inform` needs `context`).

**Pipeline:** transport in → Whisper STT → `ConfirmProcessor` → user aggregator (Silero VAD + smart-turn) → OpenRouter LLM → Piper TTS → transport out → assistant aggregator → `ActivityTracker`. The tracker must stay *after* the assistant aggregator (before it causes Anthropic's "assistant message prefill" 400).

**Plugins** (`plugins/<name>/`, loaded by `plugins/loader.py` into a `PluginBundle`): a folder with `plugin.toml` (name, `[permissions]`, `[mcp.*]` servers), `plugin.py` with `register(api)`, and optional `agents/*.md`. `PluginContext` (`plugins/api.py`) gives plugins `@api.tool`, `api.confirm(...)` and `@api.watch(every=...)`. Plugin config comes from `[plugin_settings.<name>]` in the root `config.toml`. Tools are scoped per plugin: an agent only sees its own plugin's tools and MCP servers, plus builtins from `tools/registry.py`.

**Two separate MCP stacks:**
- Miles himself uses Pipecat's `MCPClient` (`mcp/connect.py:connect_servers`), only for servers with `miles = true`. Tool schemas are appended to the `LLMContext` tool list. `McpConnection.close()` runs in the pipeline's `finally`.
- Subagents use Pydantic AI `MCPToolset` (`make_toolset`), built fresh per task from the agent's `mcp: [names]` frontmatter, whatever `miles` is set to. The stdio transport must use `keep_alive=False` or fastmcp leaves the server process running after the task ends.

**Subagents** (`agents/`): markdown files with YAML frontmatter (`AgentDef`). `TaskManager` runs them as background asyncio tasks through `run_agent` (Pydantic AI + OpenRouter) and calls `on_done`, which injects a developer message and triggers an LLM run. Miles gets `delegate`/`check_task`/`list_tasks`/`cancel_task`. The tool docstrings are the LLM's instructions (e.g. "don't poll check_task"), so edit them with care.

**Confirmations** (`confirm/`, `voice/confirm_processor.py`): a tool never blocks waiting for the user. `Confirmer.request` returns immediately, the LLM asks the question, `ConfirmProcessor` intercepts the next transcript, and a deterministic `parse_answer` decides yes/no. The action runs in code, and the outcome is injected as a developer message *before* the "Yes." transcript is forwarded to the LLM.

**Watchers** (`watchers/`): `Scheduler` runs plugin `@api.watch` functions on timers. They return `Alert`s into the `Inbox` (dedup by key, expiry). `Notifier` delivers by priority (low/normal/urgent) when `ActivityTracker` reports Miles is idle; urgent alerts interrupt. The tracker's "busy" state covers speaking, LLM running, tools running and an expected response.

**Conventions:**
- Tool functions are plain functions or async direct functions, converted by `voice/tools.py:to_pipecat`. The docstring becomes the tool description, so tools need docstrings, and they must return JSON-serializable values (plain dicts, not dataclasses; `watchers/tools.py` still violates this).
- Config is typed in `config.py` (root `config.toml`); `env.py` only holds path constants (`ROOT`, `PLUGINS_DIR`); `.env` is loaded in `main.py`.

## Working style for this repo

The owner writes the code themselves. Explain, give hints and snippets, review, and run tests. Only write whole features when they explicitly ask ("do it", "write it"). Keep answers short and plain, with a tldr first. Commits are short, human, 1–2 lines.

## Known open items

Hardcoded model/voice in `pipeline.py` (should use `config.miles.*`); `watchers/tools.py` returns `Alert` objects (not JSON-serializable) and has no docstrings; trust prompt for plugins (manifest-hash approval, warn on unpinned `@latest`) not built yet; `researcher` agent's `[mcp.playwright]` block is commented out; `context.md` and memory features not built.
