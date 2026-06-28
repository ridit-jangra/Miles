import { tool } from 'ai'
import { z } from 'zod'
import { readdirSync, statSync, readFileSync } from 'fs'
import type { Stats } from 'fs'
import { join } from 'path'
import { DESCRIPTION, PROMPT } from './prompt'

const SKIP = new Set(['node_modules', '.git', '.venv', 'dist', 'out', '.cache', '__pycache__'])
const MAX = 200
const NULL_BYTE = String.fromCharCode(0)

export const GrepTool = tool({
  title: 'Grep',
  description: DESCRIPTION + '\n\n' + PROMPT,
  inputSchema: z.object({
    pattern: z.string().describe('JavaScript regex to match against file lines'),
    path: z.string().describe('Absolute directory or file to search'),
    glob: z.string().optional().describe('Only search files ending with this suffix, e.g. ".ts"')
  }),
  execute: async ({ pattern, path, glob }) => {
    let re: RegExp
    try {
      re = new RegExp(pattern)
    } catch (err) {
      return { success: false, error: `Invalid regex: ${String(err)}` }
    }
    const matches: { file: string; line: number; text: string }[] = []
    const searchFile = (file: string): void => {
      if (matches.length >= MAX) return
      if (glob && !file.endsWith(glob)) return
      let content: string
      try {
        content = readFileSync(file, 'utf-8')
      } catch {
        return
      }
      if (content.includes(NULL_BYTE)) return
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        if (re.test(lines[i])) {
          matches.push({ file, line: i + 1, text: lines[i].slice(0, 200) })
          if (matches.length >= MAX) return
        }
      }
    }
    const walk = (entry: string, depth: number): void => {
      if (matches.length >= MAX) return
      let st: Stats
      try {
        st = statSync(entry)
      } catch {
        return
      }
      if (st.isFile()) return searchFile(entry)
      if (!st.isDirectory() || depth > 10) return
      let names: string[]
      try {
        names = readdirSync(entry)
      } catch {
        return
      }
      for (const name of names) {
        if (SKIP.has(name)) continue
        walk(join(entry, name), depth + 1)
      }
    }
    try {
      walk(path, 0)
      return { success: true, pattern, count: matches.length, matches, truncated: matches.length >= MAX }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  }
})
