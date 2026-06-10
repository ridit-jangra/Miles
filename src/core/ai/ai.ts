/* eslint-disable @typescript-eslint/no-explicit-any */
import { app } from 'electron'
import { buildProvider, createClient } from '../../../node_modules/@ridit/ai/dist/ai.js'
import {
  Session,
  createSession,
  createStore,
  type Store
} from '../../../node_modules/@ridit/ai/dist/utils.js'
import path from 'path'
import fs from 'fs'

const DATA_DIR = path.join(app.getPath('userData'), 'ai-data')

function dataPath(filename: string): string {
  return path.join(DATA_DIR, `${filename}.json`)
}

function readJson<T>(filename: string, fallback: T): T {
  const file = dataPath(filename)
  if (!fs.existsSync(file)) return fallback
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T
  } catch {
    return fallback
  }
}

function writeJson(filename: string, data: unknown): void {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(dataPath(filename), JSON.stringify(data, null, 2), 'utf-8')
}

export function buildStore(): Store {
  return createStore({
    session: {
      list: async () => {
        return readJson<any[]>('ai-sessions', [])
      },
      async load(id) {
        const sessions = await this.list()
        return sessions.find((s: any) => s.id === id) ?? null
      },
      async save(session) {
        const sessions = await this.list()
        writeJson('ai-sessions', [...sessions, session])
      }
    },
    memory: {
      list: async (): Promise<string[]> => {
        const memories = readJson<Record<string, string>>('ai-memory', {})
        return Object.keys(memories)
      },
      async read(name: string): Promise<string | null> {
        const memories = readJson<Record<string, string>>('ai-memory', {})
        return memories[name] ?? null
      },
      async write(name: string, content: string): Promise<void> {
        const memories = readJson<Record<string, string>>('ai-memory', {})
        memories[name] = content
        writeJson('ai-memory', memories)
      }
    }
  })
}

let client: ReturnType<typeof createClient> | null = null

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function getClient() {
  if (!client) {
    client = createClient({
      provider: buildProvider({
        model: 'openai/gpt-oss-20b',
        provider: 'groq',
        apiKey: process.env.GROQ_API_KEY
      })
    })
  }
  return client
}

const session = createSession()

export async function chat(text: string): Promise<{
  text: string
  session: Session
}> {
  return await getClient().run({
    prompt: text,
    system:
      'You are Echo, a voice assistant like Jarvis. Rules: NO emojis, NO markdown, NO bullet points, NO special characters, NO asterisks, NO headers. Speak in plain conversational sentences only. Keep responses under 2 sentences. Be direct and concise like a butler.',
    store: buildStore(),
    session
  })
}
