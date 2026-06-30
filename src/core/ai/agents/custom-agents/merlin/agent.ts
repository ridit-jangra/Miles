import { streamLLM } from '../../../utils/llm'
import { createSession, Session } from '../../../utils/session'
import { getMerlinSystemPrompt } from '../../../utils/systemPrompt'
import { agentTools } from '../../../utils/tools'
import { NotifyTool } from '../../../tools/NotifyTool/tool'
import { WebSearchTool } from './tools/WebSearchTool/tool'
import { WebFetchTool } from './tools/WebFetchTool/tool'
import { MemoryEditTool } from './tools/MemoryEditTool/tool'
import { MemoryReadTool } from './tools/MemoryReadTool/tool'
import { MemoryWriteTool } from './tools/MemoryWriteTool/tool'

const session = createSession()

export async function chatStream(
  prompt: string,
  onChunk: (delta: string) => void
): Promise<{ text: string; session: Session }> {
  return await streamLLM({
    prompt,
    system: await getMerlinSystemPrompt(),
    tools: {
      ...agentTools,
      NotifyTool,
      WebSearchTool,
      WebFetchTool,
      MemoryEditTool,
      MemoryReadTool,
      MemoryWriteTool
    },
    session,
    onChunk,
    onToolCall: (e) => {
      console.log(`Merlin: [Tool Call]: ${e.toolName}: ${JSON.stringify(e.input)}`)
    },
    onToolResult: (e) => {
      console.log(`Merlin: [Tool Result]: ${e.toolName}: ${JSON.stringify(e.output)}`)
    }
  })
}
