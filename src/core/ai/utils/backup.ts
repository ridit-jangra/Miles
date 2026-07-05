import { join } from 'path'
import { existsSync, mkdirSync, readdirSync, statSync, cpSync, rmSync } from 'fs'
import { ECHO_BASE_DIR, BACKUP_ROOT, storeHasContent } from './env'

const KEEP = 8
const BACKUP_INTERVAL_MS = 15 * 60 * 1000

const SKIP_TOP = new Set([
  'browser-cdp-profile',
  'milo.port',
  'assets',
  'models',
  '.git',
  'node_modules'
])

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function listBackups(): string[] {
  if (!existsSync(BACKUP_ROOT)) return []
  return readdirSync(BACKUP_ROOT)
    .filter((n) => n.startsWith('echo-'))
    .map((n) => join(BACKUP_ROOT, n))
    .filter((p) => {
      try {
        return statSync(p).isDirectory()
      } catch {
        return false
      }
    })
    .sort()
}

function prune(): void {
  const all = listBackups()
  if (all.length <= KEEP) return
  for (const dir of all.slice(0, all.length - KEEP)) {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch (err) {
      console.error('[echo] failed to prune backup', dir, err)
    }
  }
}

export function backupEchoStore(): void {
  try {
    if (!existsSync(ECHO_BASE_DIR)) return
    if (!storeHasContent(ECHO_BASE_DIR)) return

    mkdirSync(BACKUP_ROOT, { recursive: true })
    const dest = join(BACKUP_ROOT, `echo-${timestamp()}`)
    cpSync(ECHO_BASE_DIR, dest, {
      recursive: true,
      filter: (src) => {
        if (src === ECHO_BASE_DIR) return true
        const rel = src.slice(ECHO_BASE_DIR.length + 1)
        const top = rel.split(/[\\/]/)[0]
        return !SKIP_TOP.has(top)
      }
    })
    prune()
  } catch (err) {
    console.error('[echo] backup failed:', err)
  }
}

export function startBackupTimer(): () => void {
  backupEchoStore()
  const handle = setInterval(backupEchoStore, BACKUP_INTERVAL_MS)
  return () => clearInterval(handle)
}
