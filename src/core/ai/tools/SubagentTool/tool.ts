import { tool } from 'ai'
import { z } from 'zod'
import { chatStream as dexter } from '../../agents/custom-agents/dexter/agent'
import { chatStream as hank } from '../../agents/custom-agents/hank/agent'
import { chatStream as merlin } from '../../agents/custom-agents/merlin/agent'
import { chatStream as joker } from '../../agents/custom-agents/joker/agent'
import { chatStream as scout } from '../../agents/custom-agents/scout/agent'
import { say } from '../../../events/speech'
import { narrateSubagentResult } from '../../../events/narrate'
import { DESCRIPTION, PROMPT } from './prompt'

const AGENTS = { dexter, hank, merlin, joker, scout } as const

export const SubagentTool = tool({
  title: 'Subagent',
  description: DESCRIPTION + '\n\n' + PROMPT,
  inputSchema: z.object({
    agent: z
      .enum(['dexter', 'hank', 'merlin', 'joker', 'scout'])
      .describe('Which subagent to delegate to, chosen by lane'),
    task: z.string().describe('A clear, self-contained instruction for the subagent to carry out')
  }),
  execute: async ({ agent, task }) => {
    void AGENTS[agent](task, () => {})
      .then(async ({ text }) => {
        say(await narrateSubagentResult(agent, task, text))
      })
      .catch((err) => {
        say(`${agent} ran into a problem with that, sir.`)
        console.error(`[Subagent ${agent}] background task failed:`, err)
      })

    return {
      success: true,
      agent,
      status: 'running',
      note: `${agent} is handling that in the background. You stay free to keep talking with sir — its result will be spoken aloud when it finishes, so don't wait on it or claim it's done.`
    }
  }
})
