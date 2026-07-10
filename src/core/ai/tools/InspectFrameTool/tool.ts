import { tool } from 'ai'
import { z } from 'zod'
import { resolve, sep } from 'path'
import { describeImageFile } from '../../agents/custom-agents/iris/agent'
import { SCREEN_LOG_DIR } from '../../utils/env'
import { DESCRIPTION, PROMPT } from './prompt'

const inputSchema = z.object({
  image: z.string().describe('Path to a saved screen-log PNG, from a ScreenLogTool result'),
  question: z.string().optional().describe('A specific thing to find or read in the screenshot')
})

const DETAIL_PROMPT =
  'Look at this screenshot and describe it thoroughly and factually: the focused app or website, what the user is doing, and all meaningful on-screen content — headings, URLs, error messages, names, numbers, and notable UI. Read short but important text verbatim. No preamble, no speculation beyond what is visible.'

export const InspectFrameTool = tool({
  title: 'Inspect frame',
  description: DESCRIPTION + '\n\n' + PROMPT,
  inputSchema,
  execute: async ({ image, question }) => {
    const resolved = resolve(image)
    const root = resolve(SCREEN_LOG_DIR)
    if (resolved !== root && !resolved.startsWith(root + sep)) {
      return { success: false, error: 'I can only inspect screenshots from the screen log.', description: null }
    }
    try {
      const prompt = question ? `${DETAIL_PROMPT}\n\nSpecifically answer: ${question}` : DETAIL_PROMPT
      const description = await describeImageFile(resolved, prompt)
      if (!description) {
        return {
          success: false,
          error: 'Screen vision is unavailable (no OPENROUTER_API_KEY configured).',
          description: null
        }
      }
      return { success: true, error: null, description }
    } catch (err) {
      return { success: false, error: `Could not inspect that screenshot: ${String(err)}`, description: null }
    }
  },
  toModelOutput: ({ output }) => {
    if (!output.success || !output.description) {
      return { type: 'content', value: [{ type: 'text', text: output.error ?? 'Inspection failed.' }] }
    }
    return { type: 'content', value: [{ type: 'text', text: output.description }] }
  }
})
