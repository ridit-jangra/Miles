import { tool } from 'ai'
import { z } from 'zod'
import { execFile } from 'child_process'
import { readFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { DESCRIPTION, PROMPT } from './prompt'

const inputSchema = z.object({})

function capture(outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile('spectacle', ['-bnf', '-o', outPath], (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

export const ScreenshotTool = tool({
  title: 'Screenshot',
  description: DESCRIPTION + '\n\n' + PROMPT,
  inputSchema,
  execute: async () => {
    const outPath = join(tmpdir(), `echo-screen-${Date.now()}.png`)
    try {
      await capture(outPath)
      const buffer = await readFile(outPath)
      await unlink(outPath).catch(() => {})
      return { success: true, image: buffer.toString('base64') }
    } catch (err) {
      return { success: false, error: `Could not capture screen: ${String(err)}` }
    }
  },
  toModelOutput: ({ output }) => {
    if (!output.success || !output.image) {
      return {
        type: 'content',
        value: [{ type: 'text', text: output.error ?? 'Screenshot failed.' }]
      }
    }
    return {
      type: 'content',
      value: [
        { type: 'text', text: "Here is sir's current screen:" },
        { type: 'media', data: output.image, mediaType: 'image/png' }
      ]
    }
  }
})
