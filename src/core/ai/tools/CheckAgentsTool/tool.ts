import { tool } from 'ai'
import { z } from 'zod'
import { listSubagentRuns } from '../../../events/subagents'
import { DESCRIPTION, PROMPT } from './prompt'

const inputSchema = z.object({
  agent: z
    .string()
    .optional()
    .describe('Optional: only report on this one subagent (e.g. "scout"). Omit to see all.')
})

function elapsedPhrase(ms: number): string {
  const sec = Math.round(ms / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.round(sec / 60)
  if (min < 60) return `${min} min`
  const hr = Math.round(min / 60)
  return `${hr}h`
}

export const CheckAgentsTool = tool({
  title: 'Check Agents',
  description: DESCRIPTION + '\n\n' + PROMPT,
  inputSchema,
  execute: async ({ agent }) => {
    const now = Date.now()
    let runs = listSubagentRuns()
    if (agent) {
      const needle = agent.toLowerCase()
      runs = runs.filter((r) => r.agent.toLowerCase() === needle)
    }

    if (runs.length === 0) {
      return {
        agents: [],
        note: agent
          ? `No recent activity from ${agent}.`
          : 'No subagents are running or have run recently.'
      }
    }

    return {
      agents: runs.map((r) => ({
        agent: r.agent,
        status: r.status,
        task: r.task,
        runningFor: elapsedPhrase((r.finishedAt ?? now) - r.startedAt),
        idleFor: r.status === 'running' ? elapsedPhrase(now - r.updatedAt) : undefined,
        latestActivity: r.lastActivity.trim().slice(-280) || '(no output yet)'
      }))
    }
  }
})
