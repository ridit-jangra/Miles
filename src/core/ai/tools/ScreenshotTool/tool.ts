import { tool } from 'ai'
import { z } from 'zod'
import { describeScreen } from '../../agents/custom-agents/iris/agent'
import { DESCRIPTION, PROMPT } from './prompt'

const inputSchema = z.object({
  focus: z
    .string()
    .optional()
    .describe("What to look for on the screen, e.g. 'read the error dialog' or 'what app is open'")
})

const READ_PROMPT =
  "Look at this screenshot of sir's screen and answer clearly and factually. Identify the focused app and read any relevant on-screen text (errors, messages, code, dialogs) verbatim when it matters. No preamble."

export const ScreenshotTool = tool({
  title: 'Screenshot',
  description: DESCRIPTION + '\n\n' + PROMPT,
  inputSchema,
  execute: async ({ focus }) => {
    try {
      const prompt = focus ? `${READ_PROMPT}\n\nSir is asking: ${focus}` : READ_PROMPT
      const description = await describeScreen(prompt)
      if (!description) {
        return {
          success: false,
          error: 'Screen vision is unavailable (no OPENROUTER_API_KEY configured for the vision model).'
        }
      }
      return { success: true, description }
    } catch (err) {
      return { success: false, error: `Could not read screen: ${String(err)}` }
    }
  },
  toModelOutput: ({ output }) => {
    if (!output.success || !output.description) {
      return {
        type: 'content',
        value: [{ type: 'text', text: output.error ?? 'Screenshot failed.' }]
      }
    }
    return {
      type: 'content',
      value: [{ type: 'text', text: `Sir's current screen: ${output.description}` }]
    }
  }
})
