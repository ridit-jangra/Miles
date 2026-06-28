import { runLLM, streamLLM } from './utils/llm'
import { createSession, Session } from './utils/session'
import { getAgentSystemPrompt } from './utils/systemPrompt'
import { agentTools } from './utils/tools'

const session = createSession()

export async function chat(prompt: string): Promise<{ text: string; session: Session }> {
  return await runLLM({
    prompt,
    system: await getAgentSystemPrompt(),
    tools: { ...agentTools },
    session,
    onToolCall: (e) => {
      console.log(`[Tool Call]: ${e.toolName}: ${JSON.stringify(e.input)}`)
    },
    onToolResult: (e) => {
      console.log(`[Tool Call]: ${e.toolName}: ${JSON.stringify(e.output)}`)
    }
  })
}

export async function chatStream(
  prompt: string,
  onChunk: (delta: string) => void
): Promise<{ text: string; session: Session }> {
  return await streamLLM({
    prompt,
    system: await getAgentSystemPrompt(),
    tools: { ...agentTools },
    session,
    onChunk,
    onToolCall: (e) => {
      console.log(`[Tool Call]: ${e.toolName}: ${JSON.stringify(e.input)}`)
    },
    onToolResult: (e) => {
      console.log(`[Tool Call]: ${e.toolName}: ${JSON.stringify(e.output)}`)
    }
  })
}
