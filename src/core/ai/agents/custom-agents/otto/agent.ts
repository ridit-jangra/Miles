import { streamLLM } from '../../../utils/llm'
import { createSession, Session } from '../../../utils/session'
import { getOttoSystemPrompt } from '../../../utils/systemPrompt'
import { MusicTool } from '../../../tools/MusicTool/tool'
import { NotifyTool } from '../../../tools/NotifyTool/tool'
import { AskEchoTool } from '../../../tools/AskEchoTool/tool'
import { BashTool } from '../hank/tools/BashTool/tool'
import { SystemTool } from './tools/SystemTool/tool'
import { ShortcutTool } from './tools/ShortcutTool/tool'
import { MemoryWriteTool } from './tools/MemoryWriteTool/tool'
import { MemoryReadTool } from './tools/MemoryReadTool/tool'
import { MemoryEditTool } from './tools/MemoryEditTool/tool'

export async function chatStream(
  prompt: string,
  onChunk: (delta: string) => void,
  abortSignal?: AbortSignal
): Promise<{ text: string; session: Session }> {
  const session = createSession()
  return await streamLLM({
    prompt,
    abortSignal,
    system: await getOttoSystemPrompt(),
    tools: {
      MusicTool,
      SystemTool,
      ShortcutTool,
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
      console.log(`Otto: [Tool Call]: ${e.toolName}: ${JSON.stringify(e.input)}`)
    },
    onToolResult: (e) => {
      console.log(`Otto: [Tool Result]: ${e.toolName}: ${JSON.stringify(e.output)}`)
    }
  })
}
