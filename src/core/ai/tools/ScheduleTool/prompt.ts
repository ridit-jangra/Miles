export const DESCRIPTION = 'Create, list, or cancel timed reminders and scheduled tasks.'

export const PROMPT = `This is Echo's sense of "later". Use it whenever sir wants something at a future time: a reminder ("remind me to stretch in 20 minutes"), a timed action ("at 6 tell me to leave"), or a routine ("every morning at 9 give me my briefing"). Entries fire even across app restarts.

Creating — pick exactly ONE timing field:
- inMinutes: relative one-shot ("in 20 minutes" → 20).
- atTime: one-shot at a clock time today, "HH:MM" 24h local (rolls to tomorrow if already past).
- dailyAt: recurring every day at "HH:MM" 24h local.
- everyMinutes: recurring on an interval (min 5).

And exactly ONE payload:
- speak: the sentence spoken aloud when it fires. Compose it yourself in your own voice, self-contained, as if you're nudging him cold — "Sir, you asked me to remind you to stretch." — NOT the raw words he said.
- agent + task: delegate work when it fires — dexter, hank, merlin, or scout runs the task and its result is spoken automatically, exactly like a normal delegation. Use for routines like "every morning have dexter check my mentions and brief me". The task must be fully self-contained; the agent has no memory of this conversation.

Rules:
- Give label a short name ("stretch reminder", "morning briefing") — it's how sir and you refer to it later.
- After creating, confirm in one short sentence WITH when it fires ("done sir, I'll remind you at six"). No SpeakTool.
- To cancel or change one: list first if you don't know the id, then cancel (for changes: cancel and recreate). When sir asks what's scheduled, use list and summarize naturally — labels and times, not ids or JSON.
- Timing resolution is ~20 seconds; don't promise to-the-second precision.
- Don't schedule things sir wants NOW — just do those.`
