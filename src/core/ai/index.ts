import { runLLM, streamLLM } from './utils/llm'
import { createSession, Session } from './utils/session'
import { getAgentSystemPrompt } from './utils/systemPrompt'
import { agentTools } from './utils/tools'
import { mcpManager } from '../mcp/manager'

const session = createSession()

export async function chat(prompt: string): Promise<{ text: string; session: Session }> {
  return await runLLM({
    prompt,
    system: await getAgentSystemPrompt(),
    tools: { ...agentTools, ...mcpManager.getTools() },
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
    tools: { ...agentTools, ...mcpManager.getTools() },
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
