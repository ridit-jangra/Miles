export const DESCRIPTION = 'Kill a running subagent immediately.'

export const PROMPT = `When sir says to stop, cancel, or kill a subagent's task ("kill scout", "stop that search", "cancel what dexter's doing"), call this right away with that agent's name. It aborts the run mid-flight: the agent stops working, will not report back, and any question it was waiting on is withdrawn.

Rules:
- Pass the agent name (dexter, hank, merlin, scout). If several agents are running and it's unclear which one sir means, use CheckAgentsTool first — or ask him — rather than guessing.
- Omit the agent only when sir clearly wants EVERYTHING stopped ("stop all of it", "kill them all").
- Killing an agent kills all of that agent's running tasks. It cannot un-kill; if sir changes his mind, delegate the task again fresh via SubagentTool.
- After a kill, confirm to sir in one short sentence as your normal reply ("killed scout's search, sir"). No SpeakTool, no drama.
- Only for running work — if the tool says nothing was running, the task already finished or failed, so just tell sir that.`
