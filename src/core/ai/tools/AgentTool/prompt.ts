export const DESCRIPTION = 'Launch a focused sub-agent to handle a specific task.'

export const PROMPT = `Spawns a sub-agent with full tool access to complete a focused task.

Use this when:
- A subtask is too complex or long to handle inline
- You need to delegate a well-defined unit of work
- The task requires multiple tool calls but is a single concern

Do NOT use this for:
- Simple tool calls you can do directly
- Tasks requiring multiple parallel agents (use OrchestratorTool instead)
- Recursive delegation

The sub-agent has access to: FileReadTool, FileWriteTool, FileEditTool, BashTool, GrepTool.
It returns a text summary of what it did.`
