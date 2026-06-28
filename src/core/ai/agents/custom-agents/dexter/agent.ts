import { mcpManager } from '../../../../mcp/manager'
import { streamLLM } from '../../../utils/llm'
import { createSession, Session } from '../../../utils/session'
import { getDexterSystemPrompt } from '../../../utils/systemPrompt'

const session = createSession()

export async function chatStream(
  prompt: string,
  onChunk: (delta: string) => void
): Promise<{ text: string; session: Session }> {
  return await streamLLM({
    prompt,
    system: await getDexterSystemPrompt(),
    tools: { ...mcpManager.getToolsByServerNames(['slack', 'github']) },
    session,
    onChunk,
    onToolCall: (e) => {
      console.log(`Dexter: [Tool Call]: ${e.toolName}: ${JSON.stringify(e.input)}`)
    },
    onToolResult: (e) => {
      console.log(`Dexter: [Tool Call]: ${e.toolName}: ${JSON.stringify(e.output)}`)
    }
  })
}
