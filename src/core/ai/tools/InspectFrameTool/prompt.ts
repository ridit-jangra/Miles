export const DESCRIPTION =
  "I use this to take a closer look at a saved screen-log frame — it re-runs iris's vision model on the stored screenshot to pull out more detail than the one-line description captured at the time."

export const PROMPT = `ScreenLogTool returns each frame with a short description and an 'image' path on disk. When that description isn't enough — sir wants specifics, or asks something the summary doesn't answer — pass that image path here to have iris look at the actual screenshot again and read it thoroughly.

Pass:
- image (required) — the frame's PNG path from a ScreenLogTool result. Only screen-log paths work.
- question (optional) — a specific thing to find, e.g. "what was the account balance", "what URL is in the address bar", "what did the error say".

I get back a detailed factual reading of that screenshot. Use it when the logged summary is too thin, not for every frame.`
