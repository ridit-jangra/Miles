export const DESCRIPTION = "Generate ready-to-send Slack messages in sir's own voice."

export const PROMPT = `Use this when sir wants something posted in HIS style without dictating the exact content — "send something that sounds like me", "drop a message in #lounge in my style", casual banter, keeping a chat alive. It generates candidate messages from sir's real style profile (his slang, lowercase, misspellings, emoji, cadence).

How to use it:
- Pass where the message is going (channelName or isIm) so the send policy is right, and optionally a higher count for more choice.
- Read the candidates and pick the ONE that actually fits the destination and whatever conversation is happening there. Send it verbatim with the Slack tools — never stitch several candidates together and never rewrite one (that breaks the voice).
- If none fit the moment, call again once for a fresh batch rather than forcing a bad fit.
- Send policy comes from the result's "autoSend": true (DM or casual channel) → send immediately; false (work/public channel) → show sir the pick and confirm first.
- This is for open-ended "sound like me" posts only. If sir told you WHAT to say, use ComposeSlackTool with that intent instead.
- If it returns no messages, there's no style profile yet — tell sir the style analysis hasn't produced a guide, and draft plainly with confirmation if he still wants a message sent.`
