import { tool } from 'ai'
import { z } from 'zod'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { STYLE_DIR } from '../../../../../../events/slack-style-collector'
import { composeAsSir, SlackContext } from '../../../../../utils/analyzeSlackStyle'
import { DESCRIPTION, PROMPT } from './prompt'

const CASUAL_CHANNELS_FILE = join(STYLE_DIR, 'casual-channels.json')

function casualChannels(): Set<string> {
  if (!existsSync(CASUAL_CHANNELS_FILE)) return new Set()
  try {
    const list = JSON.parse(readFileSync(CASUAL_CHANNELS_FILE, 'utf-8'))
    if (!Array.isArray(list)) return new Set()
    return new Set(list.map((c: string) => c.replace(/^#/, '').toLowerCase()))
  } catch {
    return new Set()
  }
}

function isCasual(ctx: SlackContext): boolean {
  if (ctx.isIm) return true
  if (ctx.channelName && casualChannels().has(ctx.channelName.replace(/^#/, '').toLowerCase()))
    return true
  return false
}

export const ComposeSlackTool = tool({
  title: 'ComposeSlack',
  description: DESCRIPTION + '\n\n' + PROMPT,
  inputSchema: z.object({
    intent: z
      .string()
      .describe(
        "What sir wants to say, in plain terms (the substance/facts). This tool rewrites it in his voice — it must not change the meaning."
      ),
    channelName: z
      .string()
      .optional()
      .describe('The #channel name it will be sent to (without the leading #), if it is a channel.'),
    isIm: z.boolean().optional().describe('True if this is a direct message (DM) to one person.'),
    isPrivate: z.boolean().optional().describe('True if the target channel is private.')
  }),
  execute: async ({ intent, channelName, isIm, isPrivate }) => {
    try {
      const ctx: SlackContext = { channelName, isIm, isPrivate }
      const messages = await composeAsSir(intent, ctx)
      const casual = isCasual(ctx)

      if (messages.length === 0) {
        return {
          success: true,
          messages: [],
          autoSend: false,
          note: 'No style profile available yet — draft the message plainly yourself and confirm with sir before sending.'
        }
      }

      return {
        success: true,
        messages,
        context: casual ? 'casual' : 'work',
        autoSend: casual,
        guidance: casual
          ? 'Casual context — send these immediately via the Slack tools, in order, no confirmation needed.'
          : 'Work/public channel — show these drafts to sir and get confirmation before sending.'
      }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  }
})
