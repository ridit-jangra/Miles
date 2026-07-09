import { tool } from 'ai'
import { z } from 'zod'
import { execFile } from 'child_process'
import { DESCRIPTION, PROMPT } from './prompt'

const SINK = '@DEFAULT_AUDIO_SINK@'

function wpctl(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('wpctl', args, { timeout: 5000 }, (err, stdout, stderr) => {
      if (err) reject(new Error((stderr || err.message || 'wpctl failed').trim()))
      else resolve(stdout.trim())
    })
  })
}

async function readVolume(): Promise<{ volume: number; muted: boolean }> {
  const out = await wpctl(['get-volume', SINK])
  const m = out.match(/Volume:\s*([\d.]+)/)
  const volume = m ? Math.round(parseFloat(m[1]) * 100) : 0
  return { volume, muted: /MUTED/i.test(out) }
}

const inputSchema = z.object({
  action: z.enum(['get', 'set', 'adjust', 'mute']).describe('What to do with system audio'),
  level: z.number().min(0).max(100).optional().describe('For action=set: absolute volume 0-100'),
  delta: z
    .number()
    .min(-100)
    .max(100)
    .optional()
    .describe('For action=adjust: relative change, e.g. -10 quieter, +15 louder'),
  mode: z.string().optional().describe('For action=mute: on|off|toggle')
})

type Input = z.infer<typeof inputSchema>

export const SystemTool = tool({
  title: 'System',
  description: DESCRIPTION + '\n\n' + PROMPT,
  inputSchema,
  execute: async ({ action, level, delta, mode }: Input) => {
    try {
      switch (action) {
        case 'get':
          return { success: true, ...(await readVolume()) }
        case 'set': {
          if (typeof level !== 'number') {
            return { success: false, error: 'set needs a level 0-100.' }
          }
          await wpctl(['set-volume', SINK, `${(level / 100).toFixed(2)}`])
          return { success: true, ...(await readVolume()) }
        }
        case 'adjust': {
          if (typeof delta !== 'number') {
            return { success: false, error: 'adjust needs a delta.' }
          }
          const sign = delta >= 0 ? '+' : '-'
          await wpctl(['set-volume', '-l', '1.0', SINK, `${(Math.abs(delta) / 100).toFixed(2)}${sign}`])
          return { success: true, ...(await readVolume()) }
        }
        case 'mute': {
          const m = (mode || 'toggle').toLowerCase()
          const arg = m === 'toggle' ? 'toggle' : m === 'on' ? '1' : '0'
          await wpctl(['set-mute', SINK, arg])
          return { success: true, ...(await readVolume()) }
        }
      }
    } catch (err) {
      return { success: false, error: `System audio control failed: ${String(err)}` }
    }
  }
})
