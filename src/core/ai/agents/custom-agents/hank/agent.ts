import { streamLLM } from '../../../utils/llm'
import { createSession, Session } from '../../../utils/session'
import { getHankSystemPrompt } from '../../../utils/systemPrompt'
import { agentTools } from '../../../utils/tools'
import { NotifyTool } from '../../../tools/NotifyTool/tool'
import { FileWriteTool } from './tools/FileWriteTool/tool'
import { FileEditTool } from './tools/FileEditTool/tool'
import { ListDirTool } from './tools/ListDirTool/tool'
import { GrepTool } from './tools/GrepTool/tool'
import { MemoryWriteTool } from './tools/MemoryWriteTool/tool'
import { MemoryReadTool } from './tools/MemoryReadTool/tool'
import { MemoryEditTool } from './tools/MemoryEditTool/tool'
import { BashTool } from './tools/BashTool/tool'

export async function chatStream(
  prompt: string,
  onChunk: (delta: string) => void
): Promise<{ text: string; session: Session }> {
  const session = createSession()
  return await streamLLM({
    prompt,
    system: await getHankSystemPrompt(),
    tools: {
      ...agentTools,
      NotifyTool,
      FileWriteTool,
      FileEditTool,
      ListDirTool,
      GrepTool,
      MemoryWriteTool,
      MemoryReadTool,
      MemoryEditTool,
      BashTool
    },
    session,
    onChunk,
    onToolCall: (e) => {
      console.log(`Hank: [Tool Call]: ${e.toolName}: ${JSON.stringify(e.input)}`)
    },
    onToolResult: (e) => {
      console.log(`Hank: [Tool Result]: ${e.toolName}: ${JSON.stringify(e.output)}`)
    }
  })
}
