import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { generateText, type LanguageModel, type ModelMessage } from 'ai'
import { ECHO_BASE_DIR } from './env'
import { safeParseJSON } from './json'

export type OpenLoop = {
  text: string
  addedAt: number
  updatedAt: number
}

const OPEN_LOOPS_FILE = join(ECHO_BASE_DIR, 'open-loops.json')
const MAX_LOOPS = 6

export function currentOpenLoops(): OpenLoop[] {
  if (!existsSync(OPEN_LOOPS_FILE)) return []
  try {
    const loops = JSON.parse(readFileSync(OPEN_LOOPS_FILE, 'utf-8')) as OpenLoop[]
    return Array.isArray(loops) ? loops : []
  } catch {
    return []
  }
}

function saveLoops(loops: OpenLoop[]): void {
  try {
    writeFileSync(OPEN_LOOPS_FILE, JSON.stringify(loops, null, 2), 'utf-8')
  } catch (err) {
    console.error('[open-loops] failed to save:', err)
  }
}

const HARVEST_SYSTEM = `You maintain the assistant's list of "open threads" — things sir (the user) was mid-way through and would want picked back up later: a bug he was chasing, a feature half-built, something he said he'd do or decide, a question left hanging.

You get the current list and the latest conversation. Return the UPDATED list as raw JSON only: {"loops": ["...", "..."]}

Rules:
- Carry forward existing threads that are still unfinished. Keep their wording unless the conversation moved them along — then update the wording to where things stand now.
- Drop threads the conversation shows were finished, abandoned, or superseded.
- Add new threads only for concrete unfinished work or decisions from this conversation — not vague topics, moods, or completed tasks.
- Each thread is ONE short sentence naming the specific thing and where it stopped.
- At most ${MAX_LOOPS} threads, most important first. Fewer is better. An empty list is valid.`

export async function harvestOpenLoops(
  model: LanguageModel,
  messages: ModelMessage[]
): Promise<void> {
  const convo = messages.filter((m) => {
    const c = typeof m.content === 'string' ? m.content : ''
    return !(
      c.startsWith('<memory>') ||
      c.startsWith('<previous_session>') ||
      c.startsWith('Memory loaded') ||
      c.startsWith('Noted —') ||
      c.startsWith('Got it, continuing')
    )
  })
  if (convo.length === 0) return

  const existing = currentOpenLoops()
  const { text } = await generateText({
    model,
    system: HARVEST_SYSTEM,
    prompt: `Current open threads:\n${
      existing.length ? existing.map((l) => `- ${l.text}`).join('\n') : '(none)'
    }\n\nLatest conversation:\n${JSON.stringify(convo)}`
  })

  const parsed = safeParseJSON(text) as { loops?: unknown } | null
  if (!parsed || !Array.isArray(parsed.loops)) return

  const now = Date.now()
  const updated: OpenLoop[] = parsed.loops
    .filter((l): l is string => typeof l === 'string' && l.trim().length > 0)
    .slice(0, MAX_LOOPS)
    .map((textLine) => {
      const prior = existing.find((l) => l.text === textLine)
      return {
        text: textLine.trim(),
        addedAt: prior?.addedAt ?? now,
        updatedAt: prior ? prior.updatedAt : now
      }
    })

  saveLoops(updated)
}
