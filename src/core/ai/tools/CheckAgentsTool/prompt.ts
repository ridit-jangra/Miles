export const DESCRIPTION = 'Check what your background subagents are currently doing.'

export const PROMPT = `Use this to see the live status of subagents you delegated to with SubagentTool — which are still running, how long they've been at it, and a glimpse of what each is currently doing. Call it when sir asks what an agent is up to ("what's scout doing?", "is hank done yet?"), or on your own when you want to check in on a long-running task before giving sir an update.

It returns each agent's status (running, done, or failed), how long it has been going, and a short snippet of its latest activity. Relay this to sir naturally in a sentence or two — don't read the raw snippet verbatim. If nothing is running, just say so.`
