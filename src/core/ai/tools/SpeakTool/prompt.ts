export const DESCRIPTION = 'Say one short spoken line out loud right now, mid-task.'

export const PROMPT = `Your voice while you work. The text is spoken immediately through TTS, before your next tool call — use it so sir isn't left in silence during slow, multi-step work (builds, multi-file edits, browser actions, delegating to a subagent).

Rules:
- One short, natural sentence per call. Spoken English only — no markdown, lists, code, urls, or file paths.
- Use it BEFORE a slow step ("Pulling that up now", "Handing this to hank, give me a sec"), not after every tool call.
- Only for genuinely multi-step turns. For a short reply or a 0-1 tool-call turn, just answer normally instead.
- Vary your phrasing. Don't narrate every micro-step — a couple of well-placed lines is plenty.`
