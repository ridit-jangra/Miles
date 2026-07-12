import { tool } from 'ai'
import { z } from 'zod'
import { readFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'
import type { ModelMessage } from 'ai'
import { SESSIONS_DIR } from '../../utils/env'
import { DESCRIPTION, PROMPT } from './prompt'

type StoredSession = {
  id: string
  kind?: string
  messages: ModelMessage[]
  createdAt: number
  updatedAt: number
}

const SCAFFOLD_RE =
  /^(<memory>|<previous_session>|<subagent_result|<proactive_line>|Memory loaded|Noted — that|Noted — if sir|Got it, continuing)/

function messageText(content: ModelMessage['content']): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part: { type: string; text?: string }) => (part.type === 'text' ? part.text ?? '' : ''))
      .filter(Boolean)
      .join(' ')
  }
  return ''
}

function stripTone(text: string): string {
  return text.replace(/^\[tone:[^\]]*\]\s*/i, '')
}

function daysAgoPhrase(then: number): string {
  const days = Math.floor((Date.now() - then) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.round(days / 7)} weeks ago`
  return `${Math.round(days / 30)} months ago`
}

function loadSessions(): StoredSession[] {
  if (!existsSync(SESSIONS_DIR)) return []
  return readdirSync(SESSIONS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        return JSON.parse(readFileSync(join(SESSIONS_DIR, f), 'utf-8')) as StoredSession
      } catch {
        return null
      }
    })
    .filter((s): s is StoredSession => !!s)
}

type Hit = { when: string; at: number; who: 'sir' | 'you'; text: string; score: number }

export const RecallTool = tool({
  title: 'Recall',
  description: DESCRIPTION + '\n\n' + PROMPT,
  inputSchema: z.object({
    query: z.string().describe('Keywords or a short phrase to search for across all past conversations'),
    limit: z.number().min(1).max(20).optional().describe('Max moments to return (default 6)')
  }),
  execute: async ({ query, limit }) => {
    const terms = query
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 1)
    if (terms.length === 0) return { success: false, error: 'Empty query.' }

    const hits: Hit[] = []
    for (const session of loadSessions()) {
      if (session.kind && session.kind !== 'echo') continue
      for (const msg of session.messages) {
        if (msg.role !== 'user' && msg.role !== 'assistant') continue
        const raw = stripTone(messageText(msg.content)).trim()
        if (!raw || SCAFFOLD_RE.test(raw)) continue
        const hay = raw.toLowerCase()
        let score = 0
        const matched = new Set<string>()
        for (const term of terms) {
          let idx = hay.indexOf(term)
          while (idx !== -1) {
            score++
            matched.add(term)
            idx = hay.indexOf(term, idx + term.length)
          }
        }
        if (score === 0) continue
        score += matched.size * 2
        hits.push({
          when: daysAgoPhrase(session.updatedAt),
          at: session.updatedAt,
          who: msg.role === 'user' ? 'sir' : 'you',
          text: raw.length > 300 ? raw.slice(0, 300) + '…' : raw,
          score
        })
      }
    }

    if (hits.length === 0) {
      return { success: true, results: [], message: `No past conversation mentions "${query}".` }
    }

    const results = hits
      .sort((a, b) => b.score - a.score || b.at - a.at)
      .slice(0, limit ?? 6)
      .map(({ when, who, text }) => ({ when, who, text }))
    return { success: true, query, results }
  }
})
