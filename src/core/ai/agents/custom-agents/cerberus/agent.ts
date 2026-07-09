import { announce } from '../../../../events/announcements'
import type { EventAlert, Subscription } from '../../../../../shared/events'

const DIGEST_MS = 10 * 60_000
const SURFACE_THRESHOLD = 4
const URGENT_RE =
  /\b(urgent|asap|blocker|blocked|prod|production|down|outage|help|critical|emergency|deadline|broke|failing)\b/i

export type Urgency = 'high' | 'normal' | 'low'
export type Verdict = { surface: boolean; urgency: Urgency; score: number; reason: string }

const suppressed: EventAlert[] = []

export function triageAlert(alert: EventAlert, subs: Subscription[]): Verdict {
  let score = 0
  const reasons: string[] = []

  const type = subs[0]?.match.type
  if (type === 'mention') {
    score += 5
    reasons.push('you were mentioned')
  } else if (type === 'keyword') {
    score += 2
    reasons.push('watched keyword')
  } else {
    score += 1
    reasons.push('watched channel')
  }

  const text = alert.text ?? ''
  if (URGENT_RE.test(text)) {
    score += 3
    reasons.push('urgent wording')
  }
  if (/@(here|channel|everyone)/i.test(text)) {
    score += 2
    reasons.push('broadcast')
  }
  if ((alert.count ?? 1) > 3) {
    score += 1
    reasons.push('high volume')
  }

  const urgency: Urgency = score >= 6 ? 'high' : score >= SURFACE_THRESHOLD ? 'normal' : 'low'
  return { surface: score >= SURFACE_THRESHOLD, urgency, score, reason: reasons.join(', ') }
}

export function collectSuppressed(alert: EventAlert): void {
  suppressed.push(alert)
}

function flushDigest(): void {
  if (suppressed.length === 0) return
  const count = suppressed.length
  const channels = [...new Set(suppressed.map((a) => a.channelName).filter(Boolean))]
  suppressed.length = 0
  const where =
    channels.length === 0
      ? ''
      : channels.length === 1
        ? ` in ${channels[0]}`
        : ` across ${channels.length} channels`
  announce(
    `When you've got a moment sir, there ${count === 1 ? 'is' : 'are'} ${count} quieter Slack update${count === 1 ? '' : 's'}${where} you can catch up on.`
  )
}

export function startCerberus(): () => void {
  const timer = setInterval(flushDigest, DIGEST_MS)
  return () => clearInterval(timer)
}
