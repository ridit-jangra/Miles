import { tool } from 'ai'
import { z } from 'zod'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { SCREEN_LOG_DIR } from '../../utils/env'
import { DESCRIPTION, PROMPT } from './prompt'

const inputSchema = z.object({
  query: z
    .string()
    .optional()
    .describe('Details to search for across saved screens — matched against app, window title, and description'),
  date: z.string().optional().describe('Restrict to a single day, YYYY-MM-DD. Omit to search recent days.'),
  at: z.string().optional().describe('Target time HH:MM (24h) — returns the frames closest to it. Needs date.'),
  from: z.string().optional().describe('Start time HH:MM (24h), inclusive'),
  to: z.string().optional().describe('End time HH:MM (24h), inclusive')
})

const MAX_RESULTS = 40
const MAX_DAYS = 30
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

type Entry = {
  date: string
  time: string
  app: string | null
  title: string | null
  description: string | null
  image: string
  score: number
  proximity: number
}

function toMinutes(hhmm?: string): number | null {
  if (!hhmm) return null
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

function scoreFrame(hay: string, tokens: string[], phrase: string | null): number {
  let s = 0
  if (phrase && hay.includes(phrase)) s += 5
  for (const t of tokens) if (hay.includes(t)) s += 1
  return s
}

export const ScreenLogTool = tool({
  title: 'Screen log',
  description: DESCRIPTION + '\n\n' + PROMPT,
  inputSchema,
  execute: async ({ query, date, at, from, to }) => {
    let days: string[]
    try {
      if (date) {
        days = [date]
      } else {
        days = (await readdir(SCREEN_LOG_DIR))
          .filter((d) => DATE_RE.test(d))
          .sort()
          .reverse()
          .slice(0, MAX_DAYS)
      }
    } catch {
      return { success: false, error: 'No screen log has been recorded yet.', entries: [] as Entry[], total: 0 }
    }

    const fromMin = toMinutes(from)
    const toMin = toMinutes(to)
    const atMin = date ? toMinutes(at) : null
    const phrase = query?.trim().toLowerCase() || null
    const tokens = phrase ? phrase.split(/\s+/).filter((w) => w.length > 2) : []
    const entries: Entry[] = []

    for (const day of days) {
      const dir = join(SCREEN_LOG_DIR, day)
      let files: string[]
      try {
        files = (await readdir(dir)).filter((f) => f.endsWith('.json'))
      } catch {
        continue
      }
      for (const f of files) {
        try {
          const meta = JSON.parse(await readFile(join(dir, f), 'utf-8'))
          const d = new Date(meta.at)
          const mins = d.getHours() * 60 + d.getMinutes()
          if (fromMin !== null && mins < fromMin) continue
          if (toMin !== null && mins > toMin) continue
          const hay = `${meta.app ?? ''} ${meta.title ?? ''} ${meta.description ?? ''}`.toLowerCase()
          const score = phrase ? scoreFrame(hay, tokens, phrase) : 0
          if (phrase && score === 0) continue
          entries.push({
            date: day,
            time: meta.time ?? f.replace('.json', ''),
            app: meta.app ?? null,
            title: meta.title ?? null,
            description: meta.description ?? null,
            image: join(dir, f.replace('.json', '.png')),
            score,
            proximity: atMin === null ? 0 : Math.abs(mins - atMin)
          })
        } catch {
          // skip unreadable sidecar
        }
      }
    }

    if (phrase) {
      entries.sort((a, b) => b.score - a.score || `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
    } else if (atMin !== null) {
      entries.sort((a, b) => a.proximity - b.proximity)
    } else {
      entries.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
    }

    return { success: true, error: null, entries: entries.slice(0, MAX_RESULTS), total: entries.length }
  },
  toModelOutput: ({ output }) => {
    if (!output.success) {
      return { type: 'content', value: [{ type: 'text', text: output.error ?? 'Screen log lookup failed.' }] }
    }
    if (output.entries.length === 0) {
      return { type: 'content', value: [{ type: 'text', text: 'No matching screen activity was found.' }] }
    }
    const lines = output.entries.map((e) => {
      const app = e.app ?? 'unknown app'
      const title = e.title ? ` (${e.title})` : ''
      return `${e.date} ${e.time} — ${app}${title}: ${e.description ?? 'no description'}\n  image: ${e.image}`
    })
    const shown = output.entries.length
    const header = `Found ${shown}${output.total > shown ? ` of ${output.total}` : ''} matching frame(s):`
    return { type: 'content', value: [{ type: 'text', text: [header, ...lines].join('\n') }] }
  }
})
