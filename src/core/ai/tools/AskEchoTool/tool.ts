import { tool } from 'ai'
import { z } from 'zod'
import { askEcho } from '../../../events/pending-question'
import { DESCRIPTION, PROMPT } from './prompt'

export const AskEchoTool = tool({
  title: 'AskEcho',
  description: DESCRIPTION + '\n\n' + PROMPT,
  inputSchema: z.object({
    question: z
      .string()
      .describe('One clear, self-contained question for sir, phrased for him to hear aloud.')
  }),
  execute: async ({ question }) => {
    const answer = await askEcho(question)
    return { success: true, answer }
  }
})
