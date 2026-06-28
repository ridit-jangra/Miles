import { tool } from 'ai'
import { z } from 'zod'
import { writeFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import { DESCRIPTION, PROMPT } from './prompt'

export const FileWriteTool = tool({
  title: 'FileWrite',
  description: DESCRIPTION + '\n\n' + PROMPT,
  inputSchema: z.object({
    path: z.string().describe('Absolute file path to write'),
    content: z.string().describe('Full file content (overwrites the file if it exists)')
  }),
  execute: async ({ path, content }) => {
    try {
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, content, 'utf-8')
      return { success: true, path, bytes: Buffer.byteLength(content) }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  }
})
