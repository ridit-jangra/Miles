export const DESCRIPTION = "Draft a Slack message in sir's own writing voice."

export const PROMPT = `Turn what sir wants to say into a message written the way HE writes on Slack — his slang, cadence, casing, emoji — instead of generic-assistant phrasing. ALWAYS route Slack messages you send on his behalf through this tool first; never freehand the wording yourself.

Pass the INTENT (the substance of what to say, in plain terms) plus where it's going (channel name, or isIm for a DM). It returns:
- messages: the drafted text, already in sir's voice — an array, since he often fires several short bursts. Send them in order, one Slack message each.
- autoSend: whether policy allows sending without confirming.
  - true  → casual context (a DM, or a channel sir marked casual): send the drafts immediately via the Slack tools, no need to ask.
  - false → work/public channel: show sir the drafted messages and get his confirmation BEFORE sending.

Only the wording is sir's — never let the tool change the facts or intent you passed in. If it returns no messages (no style profile yet), fall back to drafting plainly and confirm before sending.`
