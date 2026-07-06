import { tool } from 'ai'
import { z } from 'zod'
import { say } from '../../../events/speech'
import { DESCRIPTION, PROMPT } from './prompt'

const recent: { text: string; at: number }[] = []
const RECENT_WINDOW_MS = 10 * 60_000

const tokens = (t: string): Set<string> =>
  new Set(
    t
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2)
  )

function tooSimilar(a: string, b: string): boolean {
  const ta = tokens(a)
  const tb = tokens(b)
  if (!ta.size || !tb.size) return false
  let shared = 0
  for (const w of ta) if (tb.has(w)) shared++
  return shared / Math.max(ta.size, tb.size) >= 0.6
}

export const SpeakTool = tool({
  title: 'Speak',
  description: DESCRIPTION + '\n\n' + PROMPT,
  inputSchema: z.object({
    text: z.string().describe('One short, natural spoken sentence to say out loud right now')
  }),
  execute: async ({ text }) => {
    const now = Date.now()
    while (recent.length && now - recent[0].at > RECENT_WINDOW_MS) recent.shift()
    if (recent.some((r) => tooSimilar(r.text, text))) {
      return {
        success: false,
        skipped:
          'Not spoken: too similar to a heads-up you already said. Stay silent and just make the next tool call.'
      }
    }
    recent.push({ text, at: now })
    if (recent.length > 8) recent.shift()
    say(text)
    return { success: true, spoken: text }
  }
})
