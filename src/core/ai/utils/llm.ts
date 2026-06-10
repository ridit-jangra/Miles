import { generateText, stepCountIs } from 'ai'
import { getModel } from './model'
import { type Session, createSession, loadMemoryIntoSession, saveSession } from './session'
import type { LLMOptions } from '../types'
import { COMPACTION_THRESHOLD, compactSession, estimateTokens, shouldCompact } from './compaction'
import { repairJSON } from './json'

export async function runLLM({
  system,
  tools,
  session,
  prompt,
  mode = 'agent',
  onToolCall,
  onToolResult,
  abortSignal
}: LLMOptions): Promise<{ text: string; session: Session }> {
  const activeSession = session ?? createSession()
  loadMemoryIntoSession(activeSession)

  const { model } = await getModel()

  if (shouldCompact(activeSession)) {
    // activeSession.messages.push({
    //   role: "user",
    //   content:
    //     "Your context is very long. Call CompactTool now with a full summary before doing anything else.",
    // });
    const summary = await generateText({
      model,
      prompt: `summarize this chat: ${JSON.stringify(activeSession.messages)}`
    })
    compactSession(activeSession, summary.text)
  }

  const messagesBeforePrompt = [...activeSession.messages]
  activeSession.messages.push({ role: 'user', content: prompt })

  const tokenCount = estimateTokens(activeSession.messages)

  const toolReminder = tools
    ? `\n\n# STRICT TOOL RULE — you may ONLY call these tools: ${Object.keys(tools).join(', ')}. Calling anything else will crash. No exceptions.`
    : ''

  const stepLimits: Record<string, number> = {
    chat: 30,
    agent: 150,
    build: 200,
    orchestratorAgent: 50,
    subagent: 50
  }

  const result = await generateText({
    model,
    system:
      system +
      `\n\n# Context usage\nTokens used so far: ~${tokenCount}. If this exceeds ${COMPACTION_THRESHOLD}, call CompactTool immediately.` +
      toolReminder,
    messages: activeSession.messages,
    stopWhen: stepCountIs(stepLimits[mode] ?? 100),
    tools,
    abortSignal,
    experimental_repairToolCall: async ({ toolCall }) => {
      const repaired = repairJSON(toolCall.input as string)
      if (repaired === null) return null
      return { ...toolCall, input: JSON.parse(repaired) }
    },
    onStepFinish: ({ toolCalls, toolResults }) => {
      for (const toolCall of toolCalls ?? []) {
        onToolCall?.({
          id: toolCall.toolCallId,
          toolName: toolCall.toolName,
          input: toolCall.input
        })
      }
      for (const toolResult of toolResults ?? []) {
        const toolCall = toolCalls?.find((t) => t.toolCallId === toolResult.toolCallId)
        onToolResult?.({
          id: toolResult.toolCallId,
          toolName: toolResult.toolName,
          input: toolCall?.input,
          output: toolResult.output
        })
      }
    }
  })

  activeSession.messages = [
    ...messagesBeforePrompt,
    { role: 'user', content: prompt },
    ...result.response.messages
  ]

  saveSession(activeSession)
  return { text: result.text, session: activeSession }
}
