import { streamLLM } from '../../../utils/llm'
import { createSession, Session } from '../../../utils/session'
import { getJokerSystemPrompt } from '../../../utils/systemPrompt'
import { agentTools } from '../../../utils/tools'
import { NotifyTool } from '../../../tools/NotifyTool/tool'

const session = createSession()

export async function chatStream(
  prompt: string,
  onChunk: (delta: string) => void
): Promise<{ text: string; session: Session }> {
  return await streamLLM({
    prompt,
    system: await getJokerSystemPrompt(),
    tools: { ...agentTools, NotifyTool },
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