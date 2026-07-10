import { homedir } from 'os'
import { join, resolve, sep, isAbsolute } from 'path'

const HOME = homedir()

export const PROTECTED_PATHS: string[] = [
  join(HOME, '.echo'),
  join(HOME, '.local', 'share', 'echo-backups'),
  join(HOME, '.claude'),
  join(HOME, '.ssh'),
  join(HOME, '.gnupg'),
  join(HOME, '.config'),
  '/etc',
  '/usr',
  '/bin',
  '/sbin',
  '/lib',
  '/lib64',
  '/boot',
  '/sys',
  '/proc',
  '/var'
]

const DESTRUCTIVE_HEADS = new Set([
  'rm',
  'rmdir',
  'unlink',
  'shred',
  'srm',
  'dd',
  'mkfs',
  'truncate',
  'mv',
  'chown',
  'chmod',
  'chgrp',
  'trash',
  'trash-put',
  'gio'
])

function isWithin(child: string, parent: string): boolean {
  const c = resolve(child)
  const p = resolve(parent)
  return c === p || c.startsWith(p + sep)
}

export function protectedRootFor(path: string): string | null {
  for (const root of PROTECTED_PATHS) {
    if (isWithin(path, root)) return root
  }
  return null
}

function expandToken(raw: string, cwd: string): string | null {
  let t = raw.replace(/^['"]|['"]$/g, '')
  if (!t || t.startsWith('-')) return null
  t = t.replace(/\$HOME|\$\{HOME\}/g, HOME)
  if (t === '~' || t.startsWith('~/')) t = join(HOME, t.slice(1))
  if (t.includes('$')) return null
  if (isAbsolute(t)) return resolve(t)
  return resolve(cwd, t)
}

const CATASTROPHIC = [
  /\brm\b[^\n]*\s(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r|--recursive)[^\n]*\s(~|\$HOME|\$\{HOME\}|\/)\s*($|[;&|])/,
  /\brm\b[^\n]*--no-preserve-root/,
  /\brm\b[^\n]*\s~\/?\*?\s*($|[;&|])/,
  /:\s*\(\)\s*\{.*\}\s*;/
]

export function scanCommandForProtected(command: string, cwd: string): string | null {
  for (const re of CATASTROPHIC) {
    if (re.test(command)) {
      return `blocked: command matches a catastrophic delete pattern (${command.trim().slice(0, 80)})`
    }
  }

  const segments = command.split(/(?:&&|\|\||[;&|\n])+/)
  for (const segment of segments) {
    const tokens = segment.trim().split(/\s+/).filter(Boolean)
    if (tokens.length === 0) continue

    const head = tokens[0].split('/').pop() || tokens[0]
    const destructive = DESTRUCTIVE_HEADS.has(head)

    let redirectPending = false
    for (let i = 1; i < tokens.length; i++) {
      const tok = tokens[i]
      if (/^>>?$/.test(tok)) {
        redirectPending = true
        continue
      }
      const attachedRedirect = /^>>?/.test(tok)
      const redirect = attachedRedirect || redirectPending
      redirectPending = false
      const target = attachedRedirect ? tok.replace(/^>>?/, '') : tok
      const candidate = target ? expandToken(target, cwd) : null
      if (!candidate) continue
      const root = protectedRootFor(candidate)
      if (root && (destructive || redirect)) {
        return `blocked: "${head}" would modify a protected path (${root}). Miles refuses to touch it.`
      }
    }
  }

  return null
}
