import { tool } from 'ai'
import { z } from 'zod'
import { readFileSync, existsSync } from 'fs'
import { MCP_CONFIG_FILE } from '../../../../../utils/env'
import { DESCRIPTION, PROMPT } from './prompt'

function getToken(): string | undefined {
  if (!existsSync(MCP_CONFIG_FILE)) return undefined
  try {
    const cfg = JSON.parse(readFileSync(MCP_CONFIG_FILE, 'utf-8'))
    const slack = Array.isArray(cfg) ? cfg.find((s: { name?: string }) => s.name === 'Slack') : undefined
    return slack?.env?.SLACK_MCP_XOXP_TOKEN
  } catch {
    return undefined
  }
}

export const ChannelInfoTool = tool({
  title: 'ChannelInfo',
  description: DESCRIPTION + '\n\n' + PROMPT,
  inputSchema: z.object({
    channelId: z
      .string()
      .describe('The Slack channel ID (starts with C, G, or D), e.g. C0B5P4N0WHH. Not a #name.')
  }),
  execute: async ({ channelId }) => {
    const token = getToken()
    if (!token) return { success: false, error: 'Slack is not connected (no token found).' }

    try {
      const url = new URL('https://slack.com/api/conversations.info')
      url.searchParams.set('channel', channelId)
      url.searchParams.set('include_num_members', 'true')
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (!data.ok) return { success: false, error: data.error || 'conversations.info failed' }

      const c = data.channel ?? {}
      return {
        success: true,
        id: c.id,
        name: c.name,
        numMembers: c.num_members,
        topic: c.topic?.value ?? '',
        purpose: c.purpose?.value ?? '',
        isPrivate: c.is_private ?? false,
        isArchived: c.is_archived ?? false
      }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  }
})
