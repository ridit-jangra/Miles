export const DESCRIPTION =
  "I use this tool to see sir's screen — it captures the current display, reads it with a vision model, and returns a plain-text description to me."

export const PROMPT = `I use this tool when I need to actually look at what's on sir's screen instead of guessing. It grabs a fullscreen screenshot, passes it to a vision model, and hands me back a text reading of what's there — so it works no matter which text model I'm running on.

Pass a 'focus' when I'm after something specific ("read the error dialog", "what does this say", "which app is open") so the reading zeroes in on it.

Use it when:
1. Sir asks "what do you see / what's on my screen / look at this / can you see this"
2. Sir refers to something visual without describing it ("what does this error say", "is this right", "read this for me")
3. I need on-screen context to answer accurately rather than assuming

Don't use it for things I can get another way (reading a file I know the path of, checking the browser via chrome-devtools). One read is enough — don't spam it; take a fresh one only when the screen has likely changed.`
