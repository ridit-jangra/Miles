import { mcpManager } from '../../../../mcp/manager'
import { streamLLM } from '../../../utils/llm'
import { createSession, Session } from '../../../utils/session'
import { getScoutSystemPrompt } from '../../../utils/systemPrompt'
import { BashTool } from '../../../tools/BashTool/tool'
import { NotifyTool } from '../../../tools/NotifyTool/tool'

const session = createSession()

export async function chatStream(
  prompt: string,
  onChunk: (delta: string) => void
): Promise<{ text: string; session: Session }> {
  return await streamLLM({
    prompt,
    system: await getScoutSystemPrompt(),
    tools: {
      ...mcpManager.getToolsByServerNames(['chrome-devtools']),
      BashTool,
      NotifyTool
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
