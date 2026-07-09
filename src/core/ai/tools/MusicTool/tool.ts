import { tool } from 'ai'
import { z } from 'zod'
import { execFile } from 'child_process'
import { DESCRIPTION, PROMPT } from './prompt'

const SEP = '\x1f'

function playerctl(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('playerctl', args, { timeout: 5000 }, (err, stdout, stderr) => {
      if (err) {
        const msg = (stderr || err.message || '').trim()
        if (/No players found/i.test(msg)) reject(new Error('NO_PLAYER'))
        else reject(new Error(msg || 'playerctl failed'))
      } else resolve(stdout.trim())
    })
  })
}

const inputSchema = z.object({
  action: z
    .enum([
      'status',
      'playpause',
      'play',
      'pause',
      'stop',
      'next',
      'previous',
      'volume',
      'shuffle',
      'loop'
    ])
    .describe('What to do with the media player'),
  level: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe('For action=volume: absolute volume 0-100'),
  delta: z
    .number()
    .min(-100)
    .max(100)
    .optional()
    .describe('For action=volume: relative change, e.g. -10 for quieter, +15 for louder'),
  mode: z
    .string()
    .optional()
    .describe("For action=shuffle: on|off|toggle. For action=loop: none|track|playlist"),
  player: z
    .string()
    .optional()
    .describe('Optional: name a specific player (e.g. spotify). Omit to control whatever is active.')
})

type Input = z.infer<typeof inputSchema>

function base(player?: string): string[] {
  return player ? ['-p', player] : []
}

async function readStatus(player?: string): Promise<Record<string, unknown>> {
  const p = base(player)
  const playback = await playerctl([...p, 'status']).catch(() => 'Stopped')
  const meta = await playerctl([
    ...p,
    'metadata',
    '--format',
    `{{title}}${SEP}{{artist}}${SEP}{{album}}`
  ]).catch(() => '')
  const [title, artist, album] = meta.split(SEP)
  const volRaw = await playerctl([...p, 'volume']).catch(() => '')
  const shuffle = await playerctl([...p, 'shuffle']).catch(() => '')
  const loop = await playerctl([...p, 'loop']).catch(() => '')
  return {
    playback,
    title: title || undefined,
    artist: artist || undefined,
    album: album || undefined,
    volume: volRaw ? Math.round(parseFloat(volRaw) * 100) : undefined,
    shuffle: shuffle ? shuffle.toLowerCase() === 'on' : undefined,
    loop: loop ? loop.toLowerCase() : undefined
  }
}

export const MusicTool = tool({
  title: 'Music',
  description: DESCRIPTION + '\n\n' + PROMPT,
  inputSchema,
  execute: async ({ action, level, delta, mode, player }: Input) => {
    const p = base(player)
    try {
      switch (action) {
        case 'status':
          return { success: true, ...(await readStatus(player)) }
        case 'play':
        case 'pause':
        case 'stop':
        case 'next':
        case 'previous':
          await playerctl([...p, action])
          return { success: true, ...(await readStatus(player)) }
        case 'playpause':
          await playerctl([...p, 'play-pause'])
          return { success: true, ...(await readStatus(player)) }
        case 'volume': {
          if (typeof level === 'number') {
            await playerctl([...p, 'volume', (level / 100).toFixed(2)])
          } else if (typeof delta === 'number') {
            const sign = delta >= 0 ? '+' : '-'
            await playerctl([...p, 'volume', `${(Math.abs(delta) / 100).toFixed(2)}${sign}`])
          } else {
            return { success: false, error: 'volume needs either level (0-100) or delta.' }
          }
          return { success: true, ...(await readStatus(player)) }
        }
        case 'shuffle': {
          const m = (mode || 'toggle').toLowerCase()
          const arg = m === 'toggle' ? 'toggle' : m === 'on' ? 'on' : 'off'
          await playerctl([...p, 'shuffle', arg])
          return { success: true, ...(await readStatus(player)) }
        }
        case 'loop': {
          const m = (mode || 'none').toLowerCase()
          const arg = m === 'track' ? 'Track' : m === 'playlist' ? 'Playlist' : 'None'
          await playerctl([...p, 'loop', arg])
          return { success: true, ...(await readStatus(player)) }
        }
      }
    } catch (err) {
      if (String(err).includes('NO_PLAYER')) {
        return { success: false, error: 'Nothing is playing — no active media player found.' }
      }
      return { success: false, error: `Media control failed: ${String(err)}` }
    }
  }
})
