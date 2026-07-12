import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { generateText } from 'ai'
import { ECHO_BASE_DIR, SESSIONS_DIR } from '../../../utils/env'
import { getModel } from '../../../utils/model'
import { turnsFromSession } from '../../../utils/analyzeUserData'
import { loadIntentions, saveIntentions, type Intention } from '../../../utils/intentions'
import { announce } from '../../../../events/announcements'
import { isDnd } from '../../../../events/dnd'
import { shouldStayQuiet } from '../sybil/agent'
import type { Session } from '../../../utils/session'

const TICK_MS = 5 * 60_000
const STARTUP_DELAY_MS = 5 * 60_000
const EXTRACT_GAP_MS = 45 * 60_000
const RAISE_COOLDOWN_MS = 6 * 60 * 60_000
const MAX_SESSIONS_PER_PASS = 12
const HABIT_WINDOW_DAYS = 3
const HABIT_SAMPLE_MINUTES = 5
const STATE_FILE = join(ECHO_BASE_DIR, 'janus-state.json')
const HABITS_FILE = join(ECHO_BASE_DIR, 'habits.jsonl')

const EXTRACT_SYSTEM = `You maintain a dated ledger of "sir"'s standing intentions — plans, goals, priorities, and wants that persist beyond a single conversation. You are given the current ledger and new dated transcripts between sir (SIR) and his assistant Miles (MILES).

Reply with ONLY raw JSON: {"add":[{"topic":"...","statement":"...","stated":"YYYY-MM-DD"}],"supersede":["id"],"confirm":["id"]}

- add: NEW durable intentions sir stated — a plan ("rewriting the app in Go"), a goal, a declared priority, something he wants to buy or build. statement = one specific self-contained sentence in third person. topic = 2-4 word label. stated = the date of the transcript where he said it. Do NOT add one-off requests, completed tasks, moods, questions, or anything an existing entry already covers.
- supersede: ids of existing intentions sir explicitly abandoned, replaced, finished, or answered "yes, the plan changed" about.
- confirm: ids of existing intentions sir restated, reaffirmed, or is clearly still pursuing.
- Only what SIR himself said counts as an intention; Miles's suggestions do not.
- When in doubt, do nothing. {"add":[],"supersede":[],"confirm":[]} is a normal answer.`

const DETECT_SYSTEM = `You are the contradiction detector for Miles, sir's voice assistant. You get sir's dated intention ledger, his recent conversations, and a summary of how he actually spent his screen time. Find cases where his recent words or behavior genuinely conflict with a stated intention — a plan he declared but has drifted from, a priority he called low but keeps working on, a stated want his actions no longer match.

Reply with ONLY raw JSON: {"contradictions":[{"id":"...","evidence":"...","line":"..."}]}

- Only flag a contradiction when the evidence is strong and spans time — one stray mention or a single afternoon is not a shift. Most runs should return {"contradictions":[]}.
- id = the conflicting intention's id. evidence = one sentence for the log.
- line = what Miles says aloud, spoken by TTS: plain words only, no markdown, under 35 words, address him as "sir", warm-Alfred register. Recall what he said with its rough timeframe ("two weeks ago you said..."), note what you've seen since, and end by asking whether the plan changed. Never mention ledgers, logs, monitoring, or percentages of anything — speak like an attentive friend who simply noticed.
- At most 2 contradictions, strongest first.`

type State = { extractedAt?: number; lastRaisedAt?: number; raised?: Record<string, number> }

type ExtractVerdict = {
  add?: { topic?: string; statement?: string; stated?: string }[]
  supersede?: string[]
  confirm?: string[]
}

type DetectVerdict = { contradictions?: { id?: string; evidence?: string; line?: string }[] }

function loadState(): State {
  if (!existsSync(STATE_FILE)) return {}
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf-8')) as State
  } catch {
    return {}
  }
}

function saveState(state: State): void {
  try {
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8')
  } catch (err) {
    console.error('[janus] failed to save state:', err)
  }
}

function parseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, '')) as T
  } catch {
    return null
  }
}

function sessionsChangedSince(since: number): boolean {
  if (!existsSync(SESSIONS_DIR)) return false
  try {
    for (const f of readdirSync(SESSIONS_DIR)) {
      if (!f.endsWith('.json')) continue
      if (statSync(join(SESSIONS_DIR, f)).mtimeMs > since) return true
    }
  } catch {
    return false
  }
  return false
}

function collectNewTranscript(sinceMs: number): string {
  if (!existsSync(SESSIONS_DIR)) return ''
  const files = readdirSync(SESSIONS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const path = join(SESSIONS_DIR, f)
      return { path, mtime: statSync(path).mtimeMs }
    })
    .filter((f) => f.mtime > sinceMs)
    .sort((a, b) => a.mtime - b.mtime)
    .slice(-MAX_SESSIONS_PER_PASS)

  const blocks: string[] = []
  for (const { path, mtime } of files) {
    let session: Session
    try {
      session = JSON.parse(readFileSync(path, 'utf-8')) as Session
    } catch {
      continue
    }
    const turns = turnsFromSession(session)
    if (turns.length === 0) continue
    const at = new Date(session.updatedAt || mtime)
    const day = `${at.toISOString().slice(0, 10)} (${at.toDateString().slice(0, 3)})`
    blocks.push(
      `### ${day}\n` +
        turns.map((t) => `${t.role === 'user' ? 'SIR' : 'MILES'}: ${t.text}`).join('\n')
    )
  }
  return blocks.join('\n\n')
}

function habitSummary(): string {
  if (!existsSync(HABITS_FILE)) return ''
  const cutoff = Date.now() - HABIT_WINDOW_DAYS * 24 * 60 * 60_000
  let samples: { at: number; app: string | null }[]
  try {
    samples = readFileSync(HABITS_FILE, 'utf-8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { at: number; app: string | null })
  } catch {
    return ''
  }
  const counts = new Map<string, number>()
  let total = 0
  for (const s of samples) {
    if (s.at < cutoff || !s.app) continue
    counts.set(s.app, (counts.get(s.app) ?? 0) + 1)
    total++
  }
  if (total === 0) return ''
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([app, n]) => {
      const hours = Math.round(((n * HABIT_SAMPLE_MINUTES) / 60) * 10) / 10
      return `${app}: ${Math.round((n / total) * 100)}% of active screen time (~${hours}h)`
    })
    .join('\n')
}

function ledgerJson(intentions: Intention[]): string {
  if (intentions.length === 0) return '(empty)'
  const day = (ms: number): string => new Date(ms).toISOString().slice(0, 10)
  return JSON.stringify(
    intentions.map((i) => ({
      id: i.id,
      topic: i.topic,
      statement: i.statement,
      stated: day(i.firstAt),
      lastConfirmed: day(i.lastAt)
    })),
    null,
    2
  )
}

function applyExtraction(intentions: Intention[], verdict: ExtractVerdict): string {
  const now = Date.now()
  const byId = new Map(intentions.map((i) => [i.id, i]))
  let superseded = 0
  for (const id of verdict.supersede ?? []) {
    const hit = byId.get(id)
    if (!hit || hit.status === 'superseded') continue
    hit.status = 'superseded'
    superseded++
  }
  let confirmed = 0
  for (const id of verdict.confirm ?? []) {
    const hit = byId.get(id)
    if (!hit || hit.status === 'superseded') continue
    hit.lastAt = now
    hit.status = 'active'
    confirmed++
  }
  let added = 0
  for (const entry of verdict.add ?? []) {
    const statement = entry.statement?.trim()
    if (!statement) continue
    const stated = entry.stated ? Date.parse(entry.stated) : NaN
    const firstAt = Number.isFinite(stated) && stated <= now ? stated : now
    intentions.push({
      id: crypto.randomUUID().slice(0, 8),
      topic: entry.topic?.trim() || 'untitled',
      statement,
      firstAt,
      lastAt: firstAt,
      status: 'active'
    })
    added++
  }
  return `+${added} ~${confirmed} -${superseded}`
}

async function runPass(state: State): Promise<void> {
  const since = state.extractedAt ?? 0
  const transcript = collectNewTranscript(since)
  state.extractedAt = Date.now()
  saveState(state)
  if (!transcript) return

  const intentions = loadIntentions()
  const current = intentions.filter((i) => i.status !== 'superseded')
  const { model } = await getModel()
  const extraction = await generateText({
    model,
    system: EXTRACT_SYSTEM,
    prompt: `## CURRENT LEDGER\n${ledgerJson(current)}\n\n## NEW TRANSCRIPTS (dated, oldest first)\n${transcript}`
  })
  const verdict = parseJson<ExtractVerdict>(extraction.text)
  if (verdict) {
    const delta = applyExtraction(intentions, verdict)
    saveIntentions(intentions)
    const active = intentions.filter((i) => i.status === 'active').length
    console.log(`[janus] ledger updated ${delta} (${active} active)`)
  }

  if (Date.now() - (state.lastRaisedAt ?? 0) < RAISE_COOLDOWN_MS) return
  const eligible = intentions.filter(
    (i) => i.status === 'active' && (state.raised?.[i.id] ?? 0) < i.lastAt
  )
  if (eligible.length === 0) return

  const habits = habitSummary()
  const detection = await generateText({
    model,
    system: DETECT_SYSTEM,
    prompt: `## INTENTION LEDGER\n${ledgerJson(eligible)}\n\n## RECENT CONVERSATIONS (dated, oldest first)\n${transcript}\n\n## HOW SIR ACTUALLY SPENT HIS SCREEN TIME (last ${HABIT_WINDOW_DAYS} days)\n${habits || '(no samples)'}`
  })
  const found = parseJson<DetectVerdict>(detection.text)
  const hit = (found?.contradictions ?? []).find(
    (c) => c.line?.trim() && eligible.some((i) => i.id === c.id)
  )
  if (!hit) {
    console.log('[janus] no contradictions found')
    return
  }
  if (shouldStayQuiet() || isDnd()) {
    console.log(`[janus] contradiction found but sir is away or in DND, holding: ${hit.line}`)
    return
  }

  const intention = intentions.find((i) => i.id === hit.id)!
  intention.status = 'questioned'
  intention.questionedAt = Date.now()
  saveIntentions(intentions)
  state.raised = state.raised ?? {}
  state.raised[intention.id] = Date.now()
  state.lastRaisedAt = Date.now()
  saveState(state)
  announce(hit.line!.trim())
  console.log(`[janus] raised contradiction on "${intention.topic}": ${hit.evidence ?? ''}`)
}

export function startJanus(): () => void {
  let stopped = false
  let running = false
  const state = loadState()
  let nextPassAt = Date.now() + STARTUP_DELAY_MS

  const tick = async (): Promise<void> => {
    if (stopped || running) return
    running = true
    try {
      if (Date.now() >= nextPassAt) {
        nextPassAt = Date.now() + EXTRACT_GAP_MS
        if (sessionsChangedSince(state.extractedAt ?? 0)) await runPass(state)
      }
    } catch (err) {
      console.error('[janus] pass failed:', err)
    } finally {
      running = false
    }
  }

  const timer = setInterval(() => void tick(), TICK_MS)
  return () => {
    stopped = true
    clearInterval(timer)
  }
}
