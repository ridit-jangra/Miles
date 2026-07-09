export const DESCRIPTION =
  "Control the machine's system audio — the master output volume and mute, independent of any one app."

export const PROMPT = `Drives the default audio sink via PipeWire (wpctl). This is the SYSTEM master volume — the whole machine's output — not one player's volume. For a specific media player's own volume, use MusicTool instead.

Actions:
- get: report current master volume (0-100) and whether it's muted.
- set: absolute master volume, 'level' 0-100.
- adjust: relative nudge, 'delta' e.g. -10 for quieter, +15 for louder.
- mute: 'mode' of on, off, or toggle.

Notes:
- Volume is capped at 100 to avoid clipping.
- If sir says "turn it down" about music that's playing, prefer MusicTool (the player's own volume); use this for "system volume" or when no player is the target.`
