import { streamLLM } from '../../../utils/llm'
import { createSession, Session } from '../../../utils/session'
import { getHankSystemPrompt } from '../../../utils/systemPrompt'
import { agentTools } from '../../../utils/tools'
import { NotifyTool } from '../../../tools/NotifyTool/tool'
import { FileWriteTool } from './tools/FileWriteTool/tool'
import { FileEditTool } from './tools/FileEditTool/tool'
import { ListDirTool } from './tools/ListDirTool/tool'
import { GrepTool } from './tools/GrepTool/tool'

const session = createSession()

export async function chatStream(
  prompt: string,
  onChunk: (delta: string) => void
): Promise<{ text: string; session: Session }> {
  return await streamLLM({
    prompt,
    system: await getHankSystemPrompt(),
    tools: { ...agentTools, NotifyTool, FileWriteTool, FileEditTool, ListDirTool, GrepTool },
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
