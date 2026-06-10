/* eslint-disable @typescript-eslint/no-require-imports */
import type { ModelMessage } from 'ai'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { PROJECT_MEMORY_FILE, SESSIONS_DIR } from './env'

export type Session = {
  id: string
  messages: ModelMessage[]
  memoryLoaded: boolean
  createdAt: number
  updatedAt: number
  compacted?: boolean
}

export function createSession(id?: string): Session {
  return {
    id: id ?? crypto.randomUUID(),
    messages: [],
    memoryLoaded: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
}

export function saveSession(session: Session): void {
  mkdirSync(SESSIONS_DIR, { recursive: true })
  const path = join(SESSIONS_DIR, `${session.id}.json`)
  session.updatedAt = Date.now()
  writeFileSync(path, JSON.stringify(session, null, 2), 'utf-8')
}

export function loadSession(id: string): Session | null {
  const path = join(SESSIONS_DIR, `${id}.json`)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as Session
  } catch {
    return null
  }
}

export function listSessions(): {
  id: string
  createdAt: number
  updatedAt: number
}[] {
  if (!existsSync(SESSIONS_DIR)) return []
  const { readdirSync } = require('fs')
  return readdirSync(SESSIONS_DIR)
    .filter((f: string) => f.endsWith('.json'))
    .map((f: string) => {
      try {
        const session = JSON.parse(readFileSync(join(SESSIONS_DIR, f), 'utf-8')) as Session
        return {
          id: session.id,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt
        }
      } catch {
        return null
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export function loadMemoryIntoSession(session: Session): Session {
  if (session.memoryLoaded) return session

  const projectMem = existsSync(PROJECT_MEMORY_FILE)
    ? readFileSync(PROJECT_MEMORY_FILE, 'utf-8')
    : ''

  const memoryContext = [projectMem ? `# Project Memory\n${projectMem}` : '']
    .filter(Boolean)
    .join('\n\n')

  if (memoryContext) {
    session.messages.push({
      role: 'user',
      content: `<memory>\n${memoryContext}\n</memory>`
    })
    session.messages.push({
      role: 'assistant',
      content: "Memory loaded. I'll apply these preferences throughout our session."
    })
  }

  session.memoryLoaded = true
  return session
}
