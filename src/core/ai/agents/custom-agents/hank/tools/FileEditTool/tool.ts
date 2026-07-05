import { tool } from 'ai'
import { z } from 'zod'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { DESCRIPTION, PROMPT } from './prompt'
import { protectedRootFor } from '../../../../../utils/protectedPaths'

export const FileEditTool = tool({
  title: 'FileEdit',
  description: DESCRIPTION + '\n\n' + PROMPT,
  inputSchema: z.object({
    path: z.string().describe('Absolute file path to edit'),
    old_string: z.string().describe('Exact text to replace (must be unique unless replace_all)'),
    new_string: z.string().describe('Replacement text'),
    replace_all: z.boolean().optional().describe('Replace every occurrence (default false)')
  }),
  execute: async ({ path, old_string, new_string, replace_all }) => {
    try {
      const root = protectedRootFor(path)
      if (root) {
        return { success: false, error: `Refused: "${path}" is inside a protected path (${root}).` }
      }
      if (!existsSync(path)) return { success: false, error: `File not found: ${path}` }
      const content = readFileSync(path, 'utf-8')
      const count = content.split(old_string).length - 1
      if (count === 0) return { success: false, error: 'old_string not found in file' }
      if (count > 1 && !replace_all) {
        return {
          success: false,
          error: `old_string matched ${count} times; add surrounding context to make it unique, or pass replace_all`
        }
      }
      const updated = replace_all
        ? content.split(old_string).join(new_string)
        : content.replace(old_string, new_string)
      writeFileSync(path, updated, 'utf-8')
      return { success: true, path, replaced: replace_all ? count : 1 }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  }
})
