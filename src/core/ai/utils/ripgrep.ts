import { rgPath } from '@vscode/ripgrep'
import { join } from 'path'
import { readdir, readFile, stat } from 'fs/promises'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export type GrepMatch = { file: string; line: number; match: string }

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'out',
  'coverage',
  '.turbo',
  '.cache',
  '.venv',
  'venv'
])

let _rgAvailable: boolean | null = null

async function isRgAvailable(): Promise<boolean> {
  if (_rgAvailable !== null) return _rgAvailable
  try {
    await execFileAsync(rgPath, ['--version'])
    _rgAvailable = true
  } catch {
    _rgAvailable = false
  }
  return _rgAvailable
}

async function grepWithRg(
  pattern: string,
  path: string,
  { caseInsensitive = false, include }: { caseInsensitive?: boolean; include?: string } = {}
): Promise<GrepMatch[]> {
  const args = [
    '--line-number',
    '--no-heading',
    '--color=never',
    '--max-count=500',
    '--glob=!node_modules/**',
    '--glob=!.git/**',
    '--glob=!dist/**',
    '--glob=!build/**',
    '--glob=!.next/**',
    '--glob=!coverage/**',
    '--glob=!.turbo/**',
    '--glob=!.cache/**'
  ]
  if (caseInsensitive) args.push('--ignore-case')
  if (include) args.push('--glob', include)
  args.push('-e', pattern, path)

  return new Promise((resolve) => {
    execFile(rgPath, args, { maxBuffer: 10_000_000, timeout: 10_000 }, (error, stdout) => {
      if (error && error.code !== 1) {
        resolve([])
        return
      }

      const results: GrepMatch[] = []
      for (const line of stdout.split('\n').filter(Boolean)) {
        const trimmed = line.replace(/\r$/, '')

        const match = trimmed.match(/^(.+):(\d+):(.*)$/)
        if (!match) continue
        const [, file, lineNum, content] = match
        if (!file || !lineNum) continue

        results.push({
          file,
          line: parseInt(lineNum),
          match: content?.trim() ?? ''
        })

        if (results.length >= 500) break
      }

      resolve(results)
    })
  })
}

async function* walkFiles(dir: string, include?: string): AsyncGenerator<string> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue
      yield* walkFiles(join(dir, entry.name), include)
    } else {
      if (include) {
        const ext = include.replace(/^\*/, '')
        if (!entry.name.endsWith(ext)) continue
      }
      yield join(dir, entry.name)
    }
  }
}

async function grepFile(filePath: string, regex: RegExp): Promise<GrepMatch[]> {
  try {
    const content = await readFile(filePath, 'utf-8')
    const lines = content.split('\n')
    const results: GrepMatch[] = []
    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i]!)) {
        results.push({ file: filePath, line: i + 1, match: lines[i]!.trim() })
      }
    }
    return results
  } catch {
    return []
  }
}

async function grepFallback(
  pattern: string,
  path: string,
  { caseInsensitive = false, include }: { caseInsensitive?: boolean; include?: string } = {}
): Promise<GrepMatch[]> {
  const regex = new RegExp(pattern, caseInsensitive ? 'i' : '')
  const results: GrepMatch[] = []

  try {
    const info = await stat(path)
    if (info.isFile()) {
      results.push(...(await grepFile(path, regex)))
    } else {
      for await (const file of walkFiles(path, include)) {
        results.push(...(await grepFile(file, regex)))
        if (results.length >= 500) break
      }
    }
  } catch {
    return []
  }

  return results.slice(0, 500)
}

export async function grep(
  pattern: string,
  path: string,
  opts: { caseInsensitive?: boolean; include?: string } = {}
): Promise<GrepMatch[]> {
  if (await isRgAvailable()) {
    return grepWithRg(pattern, path, opts)
  }
  return grepFallback(pattern, path, opts)
}
