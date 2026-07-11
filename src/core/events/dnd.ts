import { readFileSync, writeFileSync, existsSync, rmSync } from 'fs'
import { join } from 'path'
import { ECHO_BASE_DIR } from '../ai/utils/env'

const DND_FILE = join(ECHO_BASE_DIR, 'dnd.json')

type DndState = {
  until: number
  reason?: string
}

function load(): DndState | null {
  if (!existsSync(DND_FILE)) return null
  try {
    const parsed = JSON.parse(readFileSync(DND_FILE, 'utf-8')) as DndState
    return typeof parsed?.until === 'number' ? parsed : null
  } catch {
    return null
  }
}

function save(state: DndState): void {
  try {
    writeFileSync(DND_FILE, JSON.stringify(state, null, 2), 'utf-8')
  } catch (err) {
    console.error('[dnd] failed to save:', err)
  }
}

function wipe(): void {
  try {
    if (existsSync(DND_FILE)) rmSync(DND_FILE)
  } catch (err) {
    console.error('[dnd] failed to clear:', err)
  }
}

let notifyEnter: (() => void) | null = null

export function setDndEnterNotifier(fn: () => void): void {
  notifyEnter = fn
}

export function enterDnd(until: number, reason?: string): void {
  save({ until, reason })
  notifyEnter?.()
}

export function clearDnd(): boolean {
  const state = load()
  wipe()
  return state !== null && state.until > Date.now()
}

export function isDnd(): boolean {
  const state = load()
  if (!state) return false
  if (state.until <= Date.now()) {
    wipe()
    return false
  }
  return true
}

export function dndUntil(): number | null {
  const state = load()
  if (!state || state.until <= Date.now()) return null
  return state.until
}
