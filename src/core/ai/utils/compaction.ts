import type { Session } from './session'
import type { ModelMessage } from 'ai'

export const COMPACTION_THRESHOLD = 80000

export function estimateTokens(messages: ModelMessage[]): number {
  const text = JSON.stringify(messages)
  return Math.floor(text.length / 4)
}

export function shouldCompact(session: Session): boolean {
  if (session.compacted) return false
  return estimateTokens(session.messages) > COMPACTION_THRESHOLD
}

export function compactSession(session: Session, summary: string): Session {
  const memoryMessages = session.memoryLoaded ? session.messages.slice(0, 2) : []

  return {
    ...session,
    messages: [
      ...memoryMessages,
      {
        role: 'user',
        content: `<compacted_context>\n${summary}\n</compacted_context>`
      },
      {
        role: 'assistant',
        content: 'Context loaded from compacted history. Continuing from where we left off.'
      }
    ],
    compacted: true,
    updatedAt: Date.now()
  }
}
