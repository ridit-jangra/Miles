import { tool } from 'ai'
import { z } from 'zod'
import { say } from '../../../events/speech'
import { DESCRIPTION, PROMPT } from './prompt'

export const SpeakTool = tool({
  title: 'Speak',
  description: DESCRIPTION + '\n\n' + PROMPT,
  inputSchema: z.object({
    text: z.string().describe('One short, natural spoken sentence to say out loud right now')
  }),
  execute: async ({ text }) => {
    say(text)
    return { success: true, spoken: text }
  }
})
