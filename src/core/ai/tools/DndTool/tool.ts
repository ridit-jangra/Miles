import { tool } from 'ai'
import { z } from 'zod'
import { enterDnd, clearDnd, dndUntil } from '../../../events/dnd'
import { DESCRIPTION, PROMPT } from './prompt'

function minutesLeft(until: number): number {
  return Math.max(1, Math.round((until - Date.now()) / 60_000))
}

export const DndTool = tool({
  title: 'Do Not Disturb',
  description: DESCRIPTION + '\n\n' + PROMPT,
  inputSchema: z.object({
    action: z.enum(['start', 'end', 'status']).describe('What to do.'),
    forMinutes: z
      .number()
      .min(1)
      .optional()
      .describe('start: how many minutes to stay on Do Not Disturb.'),
    reason: z.string().optional().describe('start: optional short reason, e.g. "focus".')
  }),
  execute: async ({ action, forMinutes, reason }) => {
    if (action === 'status') {
      const until = dndUntil()
      return until
        ? { success: true, dnd: true, minutesLeft: minutesLeft(until), reason }
        : { success: true, dnd: false, note: 'Do Not Disturb is off.' }
    }

    if (action === 'end') {
      const wasOn = clearDnd()
      return {
        success: true,
        dnd: false,
        note: wasOn ? 'Do Not Disturb turned off.' : 'It was already off.'
      }
    }

    const minutes = forMinutes ?? 30
    const until = Date.now() + minutes * 60_000
    enterDnd(until, reason)
    return {
      success: true,
      dnd: true,
      minutes,
      until: new Date(until).toLocaleTimeString(),
      note: 'Confirm to sir in one short sentence with the duration. It also ends the moment he speaks to you again.'
    }
  }
})
