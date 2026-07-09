export const DESCRIPTION =
  "Control whatever music or media is playing on sir's machine — playback, volume, shuffle, and what's playing now."

export const PROMPT = `Controls the active media player (Spotify, a browser tab, any MPRIS-aware app) over the system media bus.

Actions:
- status: what's playing right now — track, artist, whether it's paused, volume, shuffle. Use this before answering "what's this song" or "is anything playing".
- playpause / play / pause / stop: toggle or force playback state. Prefer playpause when sir just says "pause"/"resume"/"music".
- next / previous: skip forward or back a track.
- volume: set loudness. Give 'level' for an absolute 0-100, or 'delta' for a relative nudge (e.g. -10 for "a bit quieter", +15 for "louder").
- shuffle: 'on', 'off', or 'toggle'.
- loop: 'none', 'track', or 'playlist'.

Notes:
- The bus can't search a library or queue a specific song by name — you can only drive the player that's already open. If sir asks for a track that isn't playing, say you can shuffle/skip but can't pull up a specific song, and offer to open the app instead.
- If nothing is playing you'll get told so — relay that plainly, don't invent a track.
- 'player' is optional; leave it off to control whatever is active. Only set it if sir names a specific app.`
