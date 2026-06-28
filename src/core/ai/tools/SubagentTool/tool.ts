import { tool } from 'ai'
import { z } from 'zod'
import { chatStream as dexter } from '../../agents/custom-agents/dexter/agent'
import { chatStream as hank } from '../../agents/custom-agents/hank/agent'
import { chatStream as merlin } from '../../agents/custom-agents/merlin/agent'
import { chatStream as joker } from '../../agents/custom-agents/joker/agent'
import { DESCRIPTION, PROMPT } from './prompt'

const AGENTS = { dexter, hank, merlin, joker } as const

export const SubagentTool = tool({
  title: 'Subagent',
  description: DESCRIPTION + '\n\n' + PROMPT,
  inputSchema: z.object({
    agent: z
      .enum(['dexter', 'hank', 'merlin', 'joker'])
      .describe('Which subagent to delegate to, chosen by lane'),
    task: z.string().describe('A clear, self-contained instruction for the subagent to carry out')
  }),
  execute: async ({ agent, task }) => {
    try {
      const { text } = await AGENTS[agent](task, () => {})
      return { success: true, agent, response: text }
    } catch (err) {
      return { success: false, agent, error: String(err) }
    }
  }
})
