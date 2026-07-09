import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'fs'
import { join } from 'path'
import { ECHO_BASE_DIR } from '../../../utils/env'
import { announce } from '../../../../events/announcements'
import { getVisionState } from '../argus/agent'
import { getScreenContext } from '../iris/agent'
import { getBriefing } from '../../../../briefing'
import type { Briefing } from '../../../../../shared/briefing'

const TICK_MS = 60_000
const HABIT_SAMPLE_MS = 5 * 60_000
const NUDGE_CHECK_MS = 10 * 60_000
const MIN_PATTERN_DAYS = 3
const BRIEFING_HOUR = 9
const STATE_FILE = join(ECHO_BASE_DIR, 'sybil-state.json')
const HABITS_FILE = join(ECHO_BASE_DIR, 'habits.jsonl')

type State = { lastBriefingDay?: string; nudged?: Record<string, string> }
type HabitSample = { at: number; hour: number; dow: number; present: boolean; app: string | null }
type Pattern = { hour: number; app: string; days: number }

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
    console.error('[sybil] failed to save state:', err)
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function shouldStayQuiet(): boolean {
  const vision = getVisionState()
  if (!vision.present) return true
  if (vision.available && vision.attentive === false) return true
  return false
}

export function formatBriefing(b: Briefing): string {
  const parts: string[] = []
  const gh = b.github
  if (gh) {
    if (gh.reviewRequests > 0) {
      parts.push(
        `${gh.reviewRequests} pull request${gh.reviewRequests > 1 ? 's' : ''} waiting on your review`
      )
    }
    if (gh.newStars > 0) {
      parts.push(
        `${gh.newStars} new star${gh.newStars > 1 ? 's' : ''}${gh.starRepo ? ` on ${gh.starRepo.split('/').pop()}` : ''}`
      )
    }
  }
  const slack = b.slack
  if (slack) {
    if (slack.mentions > 0) {
      parts.push(`${slack.mentions} mention${slack.mentions > 1 ? 's' : ''} on Slack`)
    }
    if (slack.unreadDms > 0) {
      parts.push(
        `${slack.unreadDms} unread direct message${slack.unreadDms > 1 ? 's' : ''}${slack.topDmFrom ? `, the busiest from ${slack.topDmFrom}` : ''}`
      )
    }
  }
  if (parts.length === 0) return "Morning, sir. Nothing notable came in overnight — you're all clear."
  const list =
    parts.length === 1
      ? parts[0]
      : parts.slice(0, -1).join(', ') + ', and ' + parts[parts.length - 1]
  return `Morning, sir. Overnight you picked up ${list}.`
}

function sampleHabit(): void {
  const now = new Date()
  const ctx = getScreenContext()
  const sample = {
    at: now.getTime(),
    hour: now.getHours(),
    dow: now.getDay(),
    present: getVisionState().present,
    app: ctx.current?.app ?? null
  }
  try {
    appendFileSync(HABITS_FILE, JSON.stringify(sample) + '\n', 'utf-8')
  } catch {
    // best-effort
  }
}

function readHabits(): HabitSample[] {
  if (!existsSync(HABITS_FILE)) return []
  try {
    return readFileSync(HABITS_FILE, 'utf-8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as HabitSample)
  } catch {
    return []
  }
}

// A pattern = the same app seen at the same hour on >= MIN_PATTERN_DAYS distinct days.
export function detectPatterns(samples: HabitSample[]): Pattern[] {
  const byHourApp = new Map<string, Set<string>>()
  for (const s of samples) {
    if (!s.app) continue
    const key = `${s.hour}:${s.app}`
    const day = new Date(s.at).toISOString().slice(0, 10)
    if (!byHourApp.has(key)) byHourApp.set(key, new Set())
    byHourApp.get(key)!.add(day)
  }
  const patterns: Pattern[] = []
  for (const [key, days] of byHourApp) {
    if (days.size < MIN_PATTERN_DAYS) continue
    const [hour, app] = key.split(/:(.+)/)
    patterns.push({ hour: Number(hour), app, days: days.size })
  }
  return patterns.sort((a, b) => b.days - a.days)
}

export function startSybil(): () => void {
  let stopped = false
  let running = false
  let lastHabitAt = 0
  let lastNudgeCheckAt = 0
  const state = loadState()

  const checkNudge = (): void => {
    if (shouldStayQuiet()) return
    const hour = new Date().getHours()
    const patterns = detectPatterns(readHabits()).filter((p) => p.hour === hour)
    if (patterns.length === 0) return
    const currentApp = getScreenContext().current?.app
    const day = today()
    state.nudged = state.nudged ?? {}
    for (const p of patterns) {
      const key = `${p.hour}:${p.app}`
      if (state.nudged[key] === day) continue
      if (currentApp && currentApp.toLowerCase() === p.app.toLowerCase()) continue
      state.nudged[key] = day
      saveState(state)
      announce(`Heads up sir — you usually have ${p.app} going around now.`)
      console.log(`[sybil] habit nudge for ${p.app} at ${hour}:00`)
      return
    }
  }

  const tick = async (): Promise<void> => {
    if (stopped || running) return
    running = true
    try {
      if (Date.now() - lastHabitAt >= HABIT_SAMPLE_MS) {
        lastHabitAt = Date.now()
        sampleHabit()
      }

      if (Date.now() - lastNudgeCheckAt >= NUDGE_CHECK_MS) {
        lastNudgeCheckAt = Date.now()
        checkNudge()
      }

      const now = new Date()
      if (
        now.getHours() >= BRIEFING_HOUR &&
        state.lastBriefingDay !== today() &&
        !shouldStayQuiet()
      ) {
        state.lastBriefingDay = today()
        saveState(state)
        try {
          const briefing = await getBriefing()
          announce(formatBriefing(briefing))
          console.log('[sybil] delivered daily briefing')
        } catch (err) {
          console.error('[sybil] briefing failed:', err)
        }
      }
    } catch (err) {
      console.error('[sybil] tick failed:', err)
    } finally {
      running = false
    }
  }

  void tick()
  const timer = setInterval(() => void tick(), TICK_MS)
  return () => {
    stopped = true
    clearInterval(timer)
  }
}
