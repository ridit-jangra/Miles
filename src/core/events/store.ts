import { readFileSync, writeFileSync, existsSync } from 'fs'
import { randomUUID } from 'crypto'
import { SUBSCRIPTIONS_FILE } from '../ai/utils/env'
import type { Subscription, SubscriptionInput } from '../../shared/events'

export function loadSubscriptions(): Subscription[] {
  if (!existsSync(SUBSCRIPTIONS_FILE)) return []
  try {
    const parsed = JSON.parse(readFileSync(SUBSCRIPTIONS_FILE, 'utf-8'))
    return Array.isArray(parsed) ? (parsed as Subscription[]) : []
  } catch (err) {
    console.error('[events] failed to read subscriptions:', err)
    return []
  }
}

function save(subs: Subscription[]): void {
  writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(subs, null, 2), 'utf-8')
}

export function addSubscription(input: SubscriptionInput): Subscription {
  const subs = loadSubscriptions()
  const sub: Subscription = { ...input, id: randomUUID(), createdAt: new Date().toISOString() }
  subs.push(sub)
  save(subs)
  return sub
}

export function removeSubscription(id: string): boolean {
  const subs = loadSubscriptions()
  const next = subs.filter((s) => s.id !== id)
  if (next.length === subs.length) return false
  save(next)
  return true
}
