import { mcpManager } from '../../../../mcp/manager'
import { streamLLM } from '../../../utils/llm'
import { createSession, Session } from '../../../utils/session'
import { getDexterSystemPrompt } from '../../../utils/systemPrompt'
import { MemoryEditTool } from './tools/MemoryEditTool/tool'
import { MemoryReadTool } from './tools/MemoryReadTool/tool'
import { MemoryWriteTool } from './tools/MemoryWriteTool/tool'
import { ComposeSlackTool } from './tools/ComposeSlackTool/tool'
import { ChannelInfoTool } from './tools/ChannelInfoTool/tool'
import { SubscribeTool } from '../../../tools/SubscribeTool/tool'
import { NotifyTool } from '../../../tools/NotifyTool/tool'
import { AskEchoTool } from '../../../tools/AskEchoTool/tool'

export async function chatStream(
  prompt: string,
  onChunk: (delta: string) => void
): Promise<{ text: string; session: Session }> {
  const session = createSession()
  return await streamLLM({
    prompt,
    system: await getDexterSystemPrompt(),
    tools: {
      ...mcpManager.getToolsByServerNames(['slack', 'github']),
      MemoryEditTool,
      MemoryWriteTool,
      MemoryReadTool,
      ComposeSlackTool,
      ChannelInfoTool,
      SubscribeTool,
      NotifyTool,
      AskEchoTool
    },
    session,
    onChunk,
    onToolCall: (e) => {
      console.log(`Dexter: [Tool Call]: ${e.toolName}: ${JSON.stringify(e.input)}`)
    },
    onToolResult: (e) => {
      console.log(`Dexter: [Tool Result]: ${e.toolName}: ${JSON.stringify(e.output)}`)
    }
  })
}
