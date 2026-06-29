export const DESCRIPTION = 'Delegate a task to a specialized subagent.'

export const PROMPT = `Spawn a focused subagent to handle work outside Echo's own lane, then relay its result back to sir concisely. Each subagent runs independently with no memory of this conversation, so pass a single, self-contained instruction with all the context it needs.

Subagents:
- dexter — Slack & GitHub. Read/search channels and DMs, post messages, summarize threads; browse or create repos, issues, and PRs.
- hank — builder & filesystem. Writes code, scripts, scaffolding; and reads/writes/edits/lists/searches files on disk.
- merlin — research. Searches the web and reads sources to answer questions with current info and citations.
- joker — chaos & testing. Breaks things on purpose to find what's fragile.

Call this immediately when a request fits a subagent's lane rather than attempting it yourself. Use the agent whose lane matches; don't use it for plain conversation or things Echo handles directly.

By default subagents run in the BACKGROUND: this tool returns right away with status "running", you stay free to keep talking with sir, and the subagent's result is spoken aloud automatically when it finishes. So after delegating, don't sit waiting and don't claim the work is done — just let sir know it's being handled and carry on. Only set wait: true when you genuinely need the subagent's output to finish the current turn (e.g. a later step depends on it); then it blocks and returns the result inline.`
