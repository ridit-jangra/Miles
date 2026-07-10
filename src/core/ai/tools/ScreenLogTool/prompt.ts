export const DESCRIPTION =
  "I use this to recall what sir was doing earlier — it searches iris's saved screen log (a screenshot plus a written description captured about once a minute) by details, date, or time, and hands me back the matching frames with their image paths on disk."

export const PROMPT = `iris archives sir's screen roughly every minute to ~/.echo/screen-log/<date>/, each frame a PNG plus a JSON sidecar holding the active app, window title, a vision-model description, and timing. This tool reads that archive back and returns matching frames, each with its image path so I can point sir to the actual screenshot (or hand the path to otto to open it).

Use it whenever sir asks about the past or wants to find a specific moment:
- By details — "find the screenshot where I was looking at that red error", "when was I watching the video about rust", "pull up that email I had open earlier". Pass those details as 'query'; it's matched against the app, window title, and description of every saved frame and returns the best matches, most relevant first. Give it the meaningful words, not a full sentence.
- By time — "what was I doing yesterday at this time". Pass 'date' plus 'at' (HH:MM) and it returns the frames CLOSEST to that moment, even if the exact minute has a gap.
- By range — pass 'date' with 'from'/'to' to get everything in a window.

'query' searches recent days automatically, so I don't need to know the date. Narrow with 'date' only when sir names a specific day. If nothing matches, widen or drop the query and try again before telling sir there's no record.`
