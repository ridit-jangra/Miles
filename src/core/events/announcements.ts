import { say } from './speech'
import { isDnd, clearDnd } from './dnd'

const QUIET_AFTER_ACTIVITY_MS = 45_000
const FLUSH_TICK_MS = 5_000

const queue: { text: string; listen: boolean }[] = []
let busyDepth = 0
let lastActivityAt = 0
let present = true

export function markActivity(): void {
  lastActivityAt = Date.now()
}

export function getLastActivityAt(): number {
  return lastActivityAt
}

export function setPresent(value: boolean): void {
  present = value
}

export function markConversationStart(): void {
  clearDnd()
  busyDepth++
  lastActivityAt = Date.now()
}

export function markConversationEnd(): void {
  busyDepth = Math.max(0, busyDepth - 1)
  lastActivityAt = Date.now()
}

function isBusy(): boolean {
  return busyDepth > 0 || Date.now() - lastActivityAt < QUIET_AFTER_ACTIVITY_MS
}

function canSpeak(): boolean {
  return present && !isBusy() && !isDnd()
}

export function announce(text: string, listen = false): void {
  const trimmed = text?.trim()
  if (!trimmed) return
  if (canSpeak()) {
    say(trimmed, listen)
    return
  }
  if (!queue.some((q) => q.text === trimmed)) queue.push({ text: trimmed, listen })
}

export function startAnnouncementFlusher(): () => void {
  const timer = setInterval(() => {
    if (queue.length === 0 || !canSpeak()) return
    for (const q of queue.splice(0, queue.length)) say(q.text, q.listen)
  }, FLUSH_TICK_MS)
  return () => clearInterval(timer)
}
