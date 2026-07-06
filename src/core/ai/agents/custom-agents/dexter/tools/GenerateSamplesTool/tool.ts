import { tool } from 'ai'
import { z } from 'zod'
import { generateSampleMessages, SlackContext } from '../../../../../utils/analyzeSlackStyle'
import { isCasualContext } from '../ComposeSlackTool/tool'
import { DESCRIPTION, PROMPT } from './prompt'

export const GenerateSamplesTool = tool({
  title: 'GenerateSamples',
  description: DESCRIPTION + '\n\n' + PROMPT,
  inputSchema: z.object({
    count: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe('How many candidate messages to generate (default 12).'),
    channelName: z
      .string()
      .optional()
      .describe('The #channel name it will be sent to (without the leading #), if it is a channel.'),
    isIm: z.boolean().optional().describe('True if this is a direct message (DM) to one person.')
  }),
  execute: async ({ count, channelName, isIm }) => {
    try {
      const messages = await generateSampleMessages(count ?? 12)
      if (messages.length === 0) {
        return {
          success: false,
          messages: [],
          autoSend: false,
          note: "No style profile yet — sir's Slack style guide hasn't been built. Tell him the style analysis needs to run first; draft plainly and confirm if he still wants something sent."
        }
      }

      const ctx: SlackContext = { channelName, isIm }
      const casual = isCasualContext(ctx)
      return {
        success: true,
        messages,
        context: casual ? 'casual' : 'work',
        autoSend: casual,
        guidance: casual
          ? 'Casual context — pick the ONE candidate that fits the destination and send it verbatim, no confirmation needed. Never stitch candidates together or rewrite them.'
          : 'Work/public channel — pick the ONE best candidate, show it to sir, and get confirmation before sending. Never stitch candidates together or rewrite them.'
      }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  }
})
