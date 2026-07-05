import { streamLLM } from '../../../utils/llm'
import { createSession, Session } from '../../../utils/session'
import { getJokerSystemPrompt } from '../../../utils/systemPrompt'
import { agentTools } from '../../../utils/tools'
import { NotifyTool } from '../../../tools/NotifyTool/tool'
import { AskEchoTool } from '../../../tools/AskEchoTool/tool'
import { MemoryWriteTool } from './tools/MemoryWriteTool/tool'
import { MemoryReadTool } from './tools/MemoryReadTool/tool'
import { MemoryEditTool } from './tools/MemoryEditTool/tool'

export async function chatStream(
  prompt: string,
  onChunk: (delta: string) => void
): Promise<{ text: string; session: Session }> {
  const session = createSession()
  return await streamLLM({
    prompt,
    system: await getJokerSystemPrompt(),
    tools: { ...agentTools, NotifyTool, AskEchoTool, MemoryWriteTool, MemoryReadTool, MemoryEditTool },
    session,
    onChunk,
    onToolCall: (e) => {
      console.log(`Joker: [Tool Call]: ${e.toolName}: ${JSON.stringify(e.input)}`)
    },
    onToolResult: (e) => {
      console.log(`Joker: [Tool Result]: ${e.toolName}: ${JSON.stringify(e.output)}`)
    }
  })
}
