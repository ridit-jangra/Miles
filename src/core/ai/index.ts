import { runLLM, streamLLM } from './utils/llm'
import { createSession, Session } from './utils/session'
import { getAgentSystemPrompt } from './utils/systemPrompt'
import { agentTools } from './utils/tools'
import { SpeakTool } from './tools/SpeakTool/tool'
import { drainSubagentResults } from '../events/subagents'

const session = createSession(undefined, 'echo')

const echoTools = { ...agentTools, SpeakTool }

function flushSubagentResults(): void {
  for (const r of drainSubagentResults()) {
    const status = r.ok ? 'finished' : 'failed'
    session.messages.push({
      role: 'user',
      content: `<subagent_result agent="${r.agent}" status="${status}">\nTask: ${r.task}\nResult:\n${r.result}\n</subagent_result>`
    })
    session.messages.push({
      role: 'assistant',
      content: `Noted — ${r.agent} ${status}, and its result was already spoken to sir aloud. I won't re-announce it; I'll use this if he asks.`
    })
  }
}

export async function chat(prompt: string): Promise<{ text: string; session: Session }> {
  flushSubagentResults()
  return await runLLM({
    prompt,
    system: await getAgentSystemPrompt(),
    tools: echoTools,
    session,
    onToolCall: (e) => {
      console.log(`[Tool Call]: ${e.toolName}: ${JSON.stringify(e.input)}`)
    },
    onToolResult: (e) => {
      console.log(`[Tool Result]: ${e.toolName}: ${JSON.stringify(e.output)}`)
    }
  })
}

export async function chatStream(
  prompt: string,
  onChunk: (delta: string) => void
): Promise<{ text: string; session: Session }> {
  flushSubagentResults()
  return await streamLLM({
    prompt,
    system: await getAgentSystemPrompt(),
    tools: echoTools,
    session,
    mode: 'agent',
    onChunk,
    onToolCall: (e) => {
      console.log(`[Tool Call]: ${e.toolName}: ${JSON.stringify(e.input)}`)
    },
    onToolResult: (e) => {
      console.log(`[Tool Result]: ${e.toolName}: ${JSON.stringify(e.output)}`)
    }
  })
}
