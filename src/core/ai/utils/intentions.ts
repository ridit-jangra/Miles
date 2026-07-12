import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { ECHO_BASE_DIR } from './env'

export const INTENTIONS_FILE = join(ECHO_BASE_DIR, 'intentions.json')

export type IntentionStatus = 'active' | 'questioned' | 'superseded'

export type Intention = {
  id: string
  topic: string
  statement: string
  firstAt: number
  lastAt: number
  status: IntentionStatus
  questionedAt?: number
}

export function loadIntentions(): Intention[] {
  if (!existsSync(INTENTIONS_FILE)) return []
  try {
    const parsed = JSON.parse(readFileSync(INTENTIONS_FILE, 'utf-8'))
    return Array.isArray(parsed) ? (parsed as Intention[]) : []
  } catch {
    return []
  }
}

export function saveIntentions(intentions: Intention[]): void {
  try {
    writeFileSync(INTENTIONS_FILE, JSON.stringify(intentions, null, 2), 'utf-8')
  } catch (err) {
    console.error('[intentions] failed to save ledger:', err)
  }
}

export function currentIntentions(): Intention[] {
  return loadIntentions()
    .filter((i) => i.status !== 'superseded')
    .sort((a, b) => b.lastAt - a.lastAt)
}
