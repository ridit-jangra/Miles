export const DESCRIPTION =
  "I use this tool to see sir's screen — it captures the current display and returns it to me as an image."

export const PROMPT = `I use this tool when I need to actually look at what's on sir's screen instead of guessing. It grabs a fullscreen screenshot and hands it to me as an image I can read.

Use it when:
1. Sir asks "what do you see / what's on my screen / look at this / can you see this"
2. Sir refers to something visual without describing it ("what does this error say", "is this right", "read this for me")
3. I need on-screen context to answer accurately rather than assuming

Don't use it for things I can get another way (reading a file I know the path of, checking the browser via chrome-devtools). One capture is enough — don't spam it; take a fresh shot only when the screen has likely changed.`
