import { tool } from 'ai'
import { z } from 'zod'
import { killSubagentRuns, listSubagentRuns } from '../../../events/subagents'
import { DESCRIPTION, PROMPT } from './prompt'

export const KillAgentTool = tool({
  title: 'Kill Agent',
  description: DESCRIPTION + '\n\n' + PROMPT,
  inputSchema: z.object({
    agent: z
      .string()
      .optional()
      .describe(
        'Which subagent to kill (dexter, hank, merlin, scout). Omit to kill ALL running subagents.'
      )
  }),
  execute: async ({ agent }) => {
    const killed = killSubagentRuns(agent)
    if (killed.length === 0) {
      const running = listSubagentRuns()
        .filter((r) => r.status === 'running')
        .map((r) => r.agent)
      return {
        success: false,
        note: agent
          ? `${agent} has nothing running — its task already finished, failed, or never started.`
          : 'No subagents are running.',
        stillRunning: running
      }
    }
    return {
      success: true,
      killed: killed.map((r) => ({ agent: r.agent, task: r.task })),
      note: 'Killed. The agent will not report back — confirm to sir in one short sentence as your normal reply.'
    }
  }
})
