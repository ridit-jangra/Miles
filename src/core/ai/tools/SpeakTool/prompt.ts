export const DESCRIPTION = 'Speak a brief heads-up out loud right before you call ANOTHER tool.'

export const PROMPT = `THE ONE RULE: only call SpeakTool when you are about to make another tool call right after it in this same turn. It fills the silence before a slow step. If you are answering, replying, stating something, or ending your turn, DO NOT use SpeakTool — just write your normal response. Your normal response is already spoken aloud automatically, so putting an answer in SpeakTool is wrong and redundant.

Valid: "Pulling that up now" → then a tool call. "Handing this to hank, give me a sec" → then a SubagentTool call.
Invalid: "I don't have access to your GPS" (that's an answer — just say it normally). "Back to the grind" / "understood" / "noted" / "copy that" (filler — say nothing).

Rules:
- One short, natural spoken sentence. No markdown, lists, code, urls, or file paths.
- Never for answers, replies, acknowledgements, or filler. Never to announce a subagent hand-off (the subagent reports its own result).
- Don't narrate every step — a couple of well-placed lines across a long multi-step turn is plenty. If you have no concrete heads-up about a slow step you're about to take, stay silent.`
