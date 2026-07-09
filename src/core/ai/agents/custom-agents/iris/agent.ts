import { execFile } from 'child_process'
import { appendFileSync } from 'fs'
import { readFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { generateText, type LanguageModel } from 'ai'
import { ECHO_BASE_DIR } from '../../../utils/env'
import { buildProvider } from '../../../utils/providers'
import { getVisionState } from '../argus/agent'

const SAMPLE_MS = 20_000
const BUFFER_LIMIT = 60
const LOG_FILE = join(ECHO_BASE_DIR, 'iris-context.jsonl')

// Screen description runs through an OpenRouter VISION model (not the active text
// model). Swap VISION_MODEL for any multimodal OpenRouter model. Calls are gated by
// presence/attention and throttled to keep cost bounded.
const VISION_ENABLED = true
const VISION_MODEL = 'google/gemini-3.1-flash-lite'
const VISION_MIN_INTERVAL_MS = 3 * 60_000
const VISION_PROMPT =
  'Describe what is on this screen in one or two plain sentences: which app is in focus and what the user appears to be doing. Be concise and factual. No preamble.'

export type ScreenSample = {
  at: number
  app: string | null
  title: string | null
  description?: string
}

export type ScreenContext = {
  detection: 'xorg' | 'degraded'
  visionAvailable: boolean
  current: ScreenSample | null
  recent: ScreenSample[]
}

const buffer: ScreenSample[] = []
let detection: 'xorg' | 'degraded' = 'degraded'
let visionModel: LanguageModel | null = null
let lastVisionAt = 0

function getVisionModel(): LanguageModel | null {
  if (!process.env.OPENROUTER_API_KEY) return null
  if (!visionModel) {
    visionModel = buildProvider({
      provider: 'openrouter',
      model: VISION_MODEL,
      name: 'iris-vision',
      apiKey: process.env.OPENROUTER_API_KEY
    })
  }
  return visionModel
}

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 3000 }, (err, stdout) => {
      resolve(err ? '' : stdout.trim())
    })
  })
}

async function detectActiveWindow(): Promise<{ app: string | null; title: string | null }> {
  const root = await run('xprop', ['-root', '_NET_ACTIVE_WINDOW'])
  const wid = root.match(/0x[0-9a-f]+/i)?.[0]
  if (!wid) return { app: null, title: null }
  const props = await run('xprop', ['-id', wid, 'WM_CLASS', '_NET_WM_NAME', 'WM_NAME'])
  if (!props) return { app: null, title: null }
  const classMatch = props.match(/WM_CLASS\(\w+\)\s*=\s*"[^"]*",\s*"([^"]*)"/)
  const nameMatch =
    props.match(/_NET_WM_NAME\(\w+\)\s*=\s*"([^"]*)"/) || props.match(/WM_NAME\(\w+\)\s*=\s*"([^"]*)"/)
  const app = classMatch?.[1] ?? null
  const title = nameMatch?.[1] ?? null
  if (app || title) detection = 'xorg'
  return { app, title }
}

function captureScreen(outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile('spectacle', ['-bnf', '-o', outPath], (err) => (err ? reject(err) : resolve()))
  })
}

export async function describeScreen(): Promise<string | undefined> {
  const model = getVisionModel()
  if (!model) return undefined
  const outPath = join(tmpdir(), `iris-${Date.now()}.png`)
  try {
    await captureScreen(outPath)
    const image = await readFile(outPath)
    const { text } = await generateText({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: VISION_PROMPT },
            { type: 'image', image }
          ]
        }
      ]
    })
    return text.trim() || undefined
  } finally {
    await unlink(outPath).catch(() => {})
  }
}

function record(sample: ScreenSample): void {
  const last = buffer[buffer.length - 1]
  if (last && last.app === sample.app && last.title === sample.title && !sample.description) return
  buffer.push(sample)
  while (buffer.length > BUFFER_LIMIT) buffer.shift()
  try {
    appendFileSync(LOG_FILE, JSON.stringify(sample) + '\n', 'utf-8')
  } catch {
    // best-effort logging only
  }
}

export function getScreenContext(): ScreenContext {
  return {
    detection,
    visionAvailable: Boolean(process.env.OPENROUTER_API_KEY),
    current: buffer[buffer.length - 1] ?? null,
    recent: buffer.slice(-15)
  }
}

export function startIris(): () => void {
  let stopped = false
  let running = false

  const tick = async (): Promise<void> => {
    if (stopped || running) return
    running = true
    try {
      const { app, title } = await detectActiveWindow()
      const last = buffer[buffer.length - 1]
      const changed = !last || last.app !== app || last.title !== title

      let description: string | undefined
      const vision = getVisionState()
      const focused = vision.present && vision.attentive !== false
      const due = Date.now() - lastVisionAt >= VISION_MIN_INTERVAL_MS
      if (VISION_ENABLED && focused && getVisionModel() && (changed || due)) {
        try {
          description = await describeScreen()
          lastVisionAt = Date.now()
        } catch (err) {
          console.error('[iris] screen description failed:', err)
        }
      }

      record({ at: Date.now(), app, title, description })
    } catch (err) {
      console.error('[iris] sample failed:', err)
    } finally {
      running = false
    }
  }

  void tick()
  const timer = setInterval(() => void tick(), SAMPLE_MS)
  return () => {
    stopped = true
    clearInterval(timer)
  }
}
