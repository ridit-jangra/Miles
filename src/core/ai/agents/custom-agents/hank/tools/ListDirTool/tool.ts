import { tool } from 'ai'
import { z } from 'zod'
import { readdirSync, statSync } from 'fs'
import { join } from 'path'
import { DESCRIPTION, PROMPT } from './prompt'

const SKIP = new Set(['node_modules', '.git', '.venv', 'dist', 'out', '.cache', '__pycache__'])
const MAX = 500

export const ListDirTool = tool({
  title: 'ListDir',
  description: DESCRIPTION + '\n\n' + PROMPT,
  inputSchema: z.object({
    path: z.string().describe('Absolute directory path to list'),
    recursive: z.boolean().optional().describe('Recurse into subdirectories (default false)')
  }),
  execute: async ({ path, recursive }) => {
    try {
      const entries: string[] = []
      const walk = (dir: string, depth: number): void => {
        if (entries.length >= MAX) return
        let names: string[]
        try {
          names = readdirSync(dir)
        } catch {
          return
        }
        for (const name of names) {
          if (entries.length >= MAX) return
          if (SKIP.has(name)) continue
          const full = join(dir, name)
          let isDir = false
          try {
            isDir = statSync(full).isDirectory()
          } catch {
            continue
          }
          entries.push(isDir ? `${full}/` : full)
          if (recursive && isDir && depth < 8) walk(full, depth + 1)
        }
      }
      walk(path, 0)
      return { success: true, path, count: entries.length, entries, truncated: entries.length >= MAX }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  }
})
