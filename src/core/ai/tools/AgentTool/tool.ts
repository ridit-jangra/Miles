import { tool } from 'ai'
import { z } from 'zod'
import { DESCRIPTION, PROMPT } from './prompt'

export const AgentTool = tool({
  title: 'Agent',
  description: DESCRIPTION + '\n\n' + PROMPT,
  inputSchema: z.object({
    prompt: z.string().describe('The task for the sub-agent to perform')
  }),
  execute: async ({ prompt }): Promise<{ success: boolean; result?: string; error?: string }> => {
    try {
      const { createSubAgent } = await import('../../agents/agent.js')
      const result = (await createSubAgent(prompt)).text
      return { success: true, result }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  }
})
