import { mcpManager } from '../../../../mcp/manager'
import { streamLLM } from '../../../utils/llm'
import { createSession, Session } from '../../../utils/session'
import { getScoutSystemPrompt } from '../../../utils/systemPrompt'
import { NotifyTool } from '../../../tools/NotifyTool/tool'
import { AskEchoTool } from '../../../tools/AskEchoTool/tool'
import { MemoryWriteTool } from './tools/MemoryWriteTool/tool'
import { MemoryReadTool } from './tools/MemoryReadTool/tool'
import { MemoryEditTool } from './tools/MemoryEditTool/tool'
import { BashTool } from '../hank/tools/BashTool/tool'

export async function chatStream(
  prompt: string,
  onChunk: (delta: string) => void,
  abortSignal?: AbortSignal
): Promise<{ text: string; session: Session }> {
  const session = createSession()
  return await streamLLM({
    prompt,
    abortSignal,
    system: await getScoutSystemPrompt(),
    tools: {
      ...mcpManager.getToolsByServerNames(['chrome-devtools']),
      BashTool,
      NotifyTool,
      AskEchoTool,
      MemoryWriteTool,
      MemoryReadTool,
      MemoryEditTool
    },
    session,
    mode: 'subagent',
    onChunk,
    onToolCall: (e) => {
      console.log(`Scout: [Tool Call]: ${e.toolName}: ${JSON.stringify(e.input)}`)
    },
    onToolResult: (e) => {
      console.log(`Scout: [Tool Result]: ${e.toolName}: ${JSON.stringify(e.output)}`)
    }
  })
}
