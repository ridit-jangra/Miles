export const DESCRIPTION =
  'Put Miles on Do Not Disturb — suppress all proactive, unprompted speech.'

export const PROMPT = `Use this when sir wants to NOT be interrupted for a while: "don't disturb me for 30 minutes", "leave me alone till 3", "quiet mode", "focus time", "shush for an hour".

While Do Not Disturb is on, Miles goes silent AND deaf: no jokes, no Slack/GitHub alerts, no scheduled nudges, no finished-subagent announcements — and the wake word and wave gesture are IGNORED, the mic stops listening after your confirmation. Nothing is lost: suppressed announcements queue up and are spoken once DND ends.

DND ends two ways, whichever comes first:
- the timer runs out (the duration sir gave), or
- sir deliberately summons Miles with the mic button — that clears DND and Miles is fully back.

Actions:
- start: begin Do Not Disturb. Pass forMinutes (how long sir asked for; default to 30 if he says "for a while" with no number). Optionally pass reason ("focus", "meeting").
- end: turn DND off right now.
- status: report whether DND is on and how much longer.

Rules:
- After starting, confirm in ONE short spoken sentence with the duration — "Alright sir, holding all interruptions for thirty minutes." No SpeakTool.
- This only silences MILES speaking up on his own — sir can still talk to Miles anytime, and doing so ends DND. Don't refuse a request during DND.
- If sir asks for a hard time ("until 3pm") rather than a duration, convert it to minutes from now and pass forMinutes.`
