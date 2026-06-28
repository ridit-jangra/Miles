import { streamLLM } from '../../../utils/llm'
import { createSession, Session } from '../../../utils/session'
import { getHankSystemPrompt } from '../../../utils/systemPrompt'
import { agentTools } from '../../../utils/tools'

const session = createSession()

export async function chatStream(
  prompt: string,
  onChunk: (delta: string) => void
): Promise<{ text: string; session: Session }> {
  return await streamLLM({
    prompt,
    system: await getHankSystemPrompt(),
    tools: { ...agentTools },
    session,
    onChunk,
    onToolCall: (e) => {
      console.log(`Joker: [Tool Call]: ${e.toolName}: ${JSON.stringify(e.input)}`)
    },
    onToolResult: (e) => {
      console.log(`Joker: [Tool Call]: ${e.toolName}: ${JSON.stringify(e.output)}`)
    }
  })
}
