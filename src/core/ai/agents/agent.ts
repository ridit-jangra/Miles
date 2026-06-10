import { runLLM } from '../utils/llm'
import type { StepToolCall, StepToolResult } from '../types'
import { getAgentSystemPrompt } from '../utils/systemPrompt'
import { agentTools, subagentTools } from '../utils/tools'
import type { Session } from '../utils/session'

export async function createAgent(
  prompt: string,
  session?: Session,
  onToolCall?: (t: StepToolCall) => void,
  onToolResult?: (t: StepToolResult) => void,
  abortSignal?: AbortSignal
): Promise<{
  text: string
  session: Session
}> {
  return runLLM({
    system: await getAgentSystemPrompt(),
    prompt,
    session,
    mode: 'agent',
    tools: agentTools,
    onToolCall,
    onToolResult,
    abortSignal
  })
}

export async function createSubAgent(
  prompt: string,
  session?: Session,
  onToolCall?: (t: StepToolCall) => void,
  onToolResult?: (t: StepToolResult) => void,
  abortSignal?: AbortSignal
): Promise<{
  text: string
  session: Session
}> {
  return runLLM({
    system: await getAgentSystemPrompt(),
    prompt,
    session,
    mode: 'subagent',
    tools: subagentTools,
    onToolCall,
    onToolResult,
    abortSignal
  })
}
