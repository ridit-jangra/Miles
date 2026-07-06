import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { ECHO_BASE_DIR, SESSIONS_DIR } from '../../../utils/env'
import { analyzeSlackStyle } from '../../../utils/analyzeSlackStyle'
import { analyzeUserData } from '../../../utils/analyzeUserData'
import { CORPUS_FILE } from '../../../../events/slack-style-collector'

const STATE_FILE = join(ECHO_BASE_DIR, 'analytics-state.json')
const TICK_MS = 5 * 60_000
const MIN_GAP_MS = 30 * 60_000
const MAX_GAP_MS = 60 * 60_000
const STARTUP_DELAY_MS = 3 * 60_000

type State = { slackRanAt?: number; sessionsRanAt?: number }

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
    console.error('[joker] failed to save state:', err)
  }
}

function nextGap(): number {
  return MIN_GAP_MS + Math.random() * (MAX_GAP_MS - MIN_GAP_MS)
}

function corpusChangedSince(since: number): boolean {
  if (!existsSync(CORPUS_FILE)) return false
  try {
    return statSync(CORPUS_FILE).mtimeMs > since
  } catch {
    return false
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

export function startJoker(): () => void {
  let stopped = false
  let running = false
  const state = loadState()

  let nextSlackAt = Math.max(Date.now() + STARTUP_DELAY_MS, (state.slackRanAt ?? 0) + nextGap())
  let nextSessionsAt = Math.max(
    Date.now() + STARTUP_DELAY_MS * 2,
    (state.sessionsRanAt ?? 0) + nextGap()
  )

  const tick = async (): Promise<void> => {
    if (stopped || running) return
    running = true
    try {
      if (Date.now() >= nextSlackAt) {
        nextSlackAt = Date.now() + nextGap()
        if (corpusChangedSince(state.slackRanAt ?? 0)) {
          const { total } = await analyzeSlackStyle()
          state.slackRanAt = Date.now()
          saveState(state)
          console.log(`[joker] slack style guide refreshed from ${total} messages`)
        }
      }

      if (stopped) return

      if (Date.now() >= nextSessionsAt) {
        nextSessionsAt = Date.now() + nextGap()
        if (sessionsChangedSince(state.sessionsRanAt ?? 0)) {
          const { sessionCount } = await analyzeUserData()
          state.sessionsRanAt = Date.now()
          saveState(state)
          console.log(`[joker] user profile refreshed from ${sessionCount} sessions`)
        }
      }
    } catch (err) {
      console.error('[joker] analytics run failed:', err)
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
