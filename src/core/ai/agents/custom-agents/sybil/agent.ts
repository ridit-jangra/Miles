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
const BRIEFING_HOUR = 9
const STATE_FILE = join(ECHO_BASE_DIR, 'sybil-state.json')
const HABITS_FILE = join(ECHO_BASE_DIR, 'habits.jsonl')

type State = { lastBriefingDay?: string }

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

export function startSybil(): () => void {
  let stopped = false
  let running = false
  let lastHabitAt = 0
  const state = loadState()

  const tick = async (): Promise<void> => {
    if (stopped || running) return
    running = true
    try {
      if (Date.now() - lastHabitAt >= HABIT_SAMPLE_MS) {
        lastHabitAt = Date.now()
        sampleHabit()
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
