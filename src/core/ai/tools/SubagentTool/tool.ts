import { tool } from 'ai'
import { z } from 'zod'
import { chatStream as dexter } from '../../agents/custom-agents/dexter/agent'
import { chatStream as hank } from '../../agents/custom-agents/hank/agent'
import { chatStream as merlin } from '../../agents/custom-agents/merlin/agent'
import { chatStream as joker } from '../../agents/custom-agents/joker/agent'
import { say } from '../../../events/speech'
import { narrateSubagentResult } from '../../../events/narrate'
import { DESCRIPTION, PROMPT } from './prompt'

const AGENTS = { dexter, hank, merlin, joker } as const

export const SubagentTool = tool({
  title: 'Subagent',
  description: DESCRIPTION + '\n\n' + PROMPT,
  inputSchema: z.object({
    agent: z
      .enum(['dexter', 'hank', 'merlin', 'joker'])
      .describe('Which subagent to delegate to, chosen by lane'),
    task: z.string().describe('A clear, self-contained instruction for the subagent to carry out'),
    wait: z
      .boolean()
      .optional()
      .describe(
        'Default false. Leave false to run in the background — Echo stays responsive and speaks the result when it is done. Set true only when you need the output to continue this same turn.'
      )
  }),
  execute: async ({ agent, task, wait }) => {
    if (wait) {
      try {
        const { text } = await AGENTS[agent](task, () => {})
        return { success: true, agent, response: text }
      } catch (err) {
        return { success: false, agent, error: String(err) }
      }
    }

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
