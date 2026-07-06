export const DESCRIPTION = 'Speak a brief heads-up out loud right before you call ANOTHER tool.'

export const PROMPT = `THE ONE RULE: only call SpeakTool when you are about to make another tool call right after it in this same turn. It fills the silence before a slow step. If you are answering, replying, stating something, or ending your turn, DO NOT use SpeakTool — just write your normal response. Your normal response is already spoken aloud automatically, so putting an answer in SpeakTool is wrong and redundant.

Valid: "Pulling that up now" → then a file read or search call you run yourself.
Invalid: "I don't have access to your GPS" (that's an answer — just say it normally). "Back to the grind" / "understood" / "noted" / "copy that" (filler — say nothing). ANY line before a SubagentTool call ("looking into that", "digging into the messages", "handing this off") — delegation is ALWAYS silent; the subagent voices its own progress and result, so a heads-up from you double-speaks.

Rules:
- One short, natural spoken sentence. No markdown, lists, code, urls, or file paths.
- Never for answers, replies, acknowledgements, or filler. Never before a SubagentTool call, no exceptions.
- Never say the same thing twice: if you already spoke a heads-up this session, don't speak another one that means the same thing with new words.
- Don't narrate every step — a couple of well-placed lines across a long multi-step turn is plenty. If you have no concrete heads-up about a slow step you're about to take, stay silent.`
