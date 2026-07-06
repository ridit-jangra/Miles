import { tool } from 'ai'
import { z } from 'zod'
import {
  createSchedule,
  listSchedules,
  cancelSchedule,
  nextDailyAt,
  type ScheduleAgent,
  type ScheduleEntry
} from '../../../events/scheduler'
import { DESCRIPTION, PROMPT } from './prompt'

const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/

function describe(entry: ScheduleEntry): Record<string, unknown> {
  return {
    id: entry.id,
    label: entry.label,
    kind: entry.kind,
    nextFire: new Date(entry.nextAt).toLocaleString(),
    ...(entry.time ? { dailyAt: entry.time } : {}),
    ...(entry.everyMs ? { everyMinutes: Math.round(entry.everyMs / 60_000) } : {}),
    ...(entry.speak ? { speak: entry.speak } : {}),
    ...(entry.task ? { agent: entry.task.agent, task: entry.task.instruction } : {})
  }
}

export const ScheduleTool = tool({
  title: 'Schedule',
  description: DESCRIPTION + '\n\n' + PROMPT,
  inputSchema: z.object({
    action: z.enum(['create', 'list', 'cancel']).describe('What to do.'),
    label: z.string().optional().describe('Short human name for the entry (create).'),
    inMinutes: z.number().min(1).optional().describe('One-shot: fire this many minutes from now.'),
    atTime: z
      .string()
      .optional()
      .describe('One-shot: fire at this local clock time today, "HH:MM" 24h (tomorrow if past).'),
    dailyAt: z.string().optional().describe('Recurring: fire every day at "HH:MM" 24h local.'),
    everyMinutes: z.number().min(5).optional().describe('Recurring: fire every N minutes.'),
    speak: z
      .string()
      .optional()
      .describe('The self-contained sentence spoken aloud when it fires.'),
    agent: z
      .enum(['dexter', 'hank', 'merlin', 'scout'])
      .optional()
      .describe('Subagent to run the task when it fires.'),
    task: z
      .string()
      .optional()
      .describe('Self-contained instruction for the agent when it fires.'),
    id: z.string().optional().describe('Entry id to cancel.')
  }),
  execute: async ({ action, label, inMinutes, atTime, dailyAt, everyMinutes, speak, agent, task, id }) => {
    if (action === 'list') {
      const entries = listSchedules()
      return entries.length
        ? { success: true, schedules: entries.map(describe) }
        : { success: true, schedules: [], note: 'Nothing is scheduled.' }
    }

    if (action === 'cancel') {
      if (!id) return { success: false, error: 'Pass the entry id to cancel — use list to find it.' }
      const removed = cancelSchedule(id)
      return removed
        ? { success: true, cancelled: describe(removed) }
        : { success: false, error: `No schedule with id ${id}. Use list to see what exists.` }
    }

    const timings = [inMinutes, atTime, dailyAt, everyMinutes].filter((v) => v !== undefined)
    if (timings.length !== 1)
      return {
        success: false,
        error: 'Pass exactly one timing field: inMinutes, atTime, dailyAt, or everyMinutes.'
      }
    if ((atTime && !TIME_RE.test(atTime)) || (dailyAt && !TIME_RE.test(dailyAt)))
      return { success: false, error: 'Times must be "HH:MM" in 24h format, e.g. "18:30".' }

    const hasTask = agent !== undefined && task !== undefined
    if (!speak && !hasTask)
      return {
        success: false,
        error: 'Pass a payload: either speak, or agent + task together.'
      }
    if (speak && hasTask)
      return { success: false, error: 'Pass either speak or agent + task, not both.' }

    const now = Date.now()
    let kind: ScheduleEntry['kind']
    let nextAt: number
    let time: string | undefined
    let everyMs: number | undefined

    if (inMinutes !== undefined) {
      kind = 'once'
      nextAt = now + inMinutes * 60_000
    } else if (atTime) {
      kind = 'once'
      nextAt = nextDailyAt(atTime, now)
    } else if (dailyAt) {
      kind = 'daily'
      time = dailyAt
      nextAt = nextDailyAt(dailyAt, now)
    } else {
      kind = 'interval'
      everyMs = everyMinutes! * 60_000
      nextAt = now + everyMs
    }

    const entry = createSchedule({
      label: label || (speak ?? task ?? 'scheduled entry').slice(0, 60),
      kind,
      nextAt,
      time,
      everyMs,
      speak,
      task: hasTask ? { agent: agent as ScheduleAgent, instruction: task! } : undefined
    })

    return {
      success: true,
      created: describe(entry),
      note: 'Confirm to sir in one short sentence including when it fires.'
    }
  }
})
