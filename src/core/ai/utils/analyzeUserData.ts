import { generateText } from 'ai'
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { getModel } from './model'
import { ECHO_BASE_DIR, SESSIONS_DIR } from './env'
import type { Session } from './session'

export const USER_ANALYTICS_FILE = join(ECHO_BASE_DIR, 'user-analytics.md')

type Turn = { role: 'user' | 'echo'; text: string }

function textFromContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .filter((p) => p && typeof p === 'object' && (p as { type?: string }).type === 'text')
    .map((p) => (p as { text?: string }).text ?? '')
    .join(' ')
    .trim()
}

function turnsFromSession(session: Session): Turn[] {
  const turns: Turn[] = []
  for (const message of session.messages) {
    if (message.role === 'user') {
      const text = textFromContent(message.content)
      if (!text || text.startsWith('<memory>')) continue
      turns.push({ role: 'user', text })
    } else if (message.role === 'assistant') {
      const text = textFromContent(message.content)
      if (!text || text === "Memory loaded. I'll apply these throughout our session.") continue
      turns.push({ role: 'echo', text })
    }
  }
  return turns
}

export function collectTranscript(maxSessions = 50): { transcript: string; sessionCount: number } {
  if (!existsSync(SESSIONS_DIR)) return { transcript: '', sessionCount: 0 }

  const files = readdirSync(SESSIONS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const path = join(SESSIONS_DIR, f)
      return { path, mtime: statSync(path).mtimeMs }
    })
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, maxSessions)

  const blocks: string[] = []
  for (const { path } of files) {
    let session: Session
    try {
      session = JSON.parse(readFileSync(path, 'utf-8')) as Session
    } catch {
      continue
    }
    const turns = turnsFromSession(session)
    if (turns.length === 0) continue
    const block = turns.map((t) => `${t.role === 'user' ? 'SIR' : 'ECHO'}: ${t.text}`).join('\n')
    blocks.push(block)
  }

  return { transcript: blocks.join('\n\n---\n\n'), sessionCount: blocks.length }
}

const ANALYSIS_PROMPT = `You are building a living profile of "sir", the user of a voice assistant named Echo, by studying transcripts of their past conversations. The goal is for Echo to anticipate what sir will do next and to subtly mirror how sir talks.

Below is the EXISTING profile (may be empty) followed by NEW transcripts. Update and refine the profile — keep what still holds, revise what changed, drop what's stale. Be specific and evidence-based; never invent traits not visible in the transcripts. Write it in clean markdown with these sections:

# Routines & Patterns
Recurring requests, time-of-day habits, the kinds of tasks sir leans on Echo for.

# Predicted Next Actions
Given the patterns, what sir is likely to ask for or do next, and in what situations.

# Speech Fingerprint
How sir actually talks — vocabulary, slang, sentence length, punctuation habits, greetings/sign-offs, directness, tone. Quote 3-5 short verbatim phrases that are characteristically his.

# Topics & Interests
What sir cares about, projects in flight, people and tools that come up.

Keep the whole profile under ~600 words. Output ONLY the markdown profile, nothing else.`

export async function analyzeUserData(
  maxSessions = 50
): Promise<{ profile: string; sessionCount: number }> {
  const { transcript, sessionCount } = collectTranscript(maxSessions)
  if (!transcript) return { profile: '', sessionCount: 0 }

  const existing = existsSync(USER_ANALYTICS_FILE)
    ? readFileSync(USER_ANALYTICS_FILE, 'utf-8').trim()
    : ''

  const { model } = await getModel()
  const { text } = await generateText({
    model,
    system: ANALYSIS_PROMPT,
    prompt: `## EXISTING PROFILE\n${existing || '(none yet)'}\n\n## NEW TRANSCRIPTS\n${transcript}`
  })

  const profile = text.trim()
  if (profile) writeFileSync(USER_ANALYTICS_FILE, profile, 'utf-8')
  return { profile, sessionCount }
}
