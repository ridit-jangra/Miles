import { tool } from 'ai'
import { z } from 'zod'
import { addSubscription, loadSubscriptions, removeSubscription } from '../../../events/store'
import type { SubscriptionMatch } from '../../../../shared/events'
import { DESCRIPTION, PROMPT } from './prompt'

export const SubscribeTool = tool({
  title: 'Subscribe',
  description: DESCRIPTION + '\n\n' + PROMPT,
  inputSchema: z.object({
    action: z.enum(['create', 'list', 'remove']),
    matchType: z
      .enum(['channel', 'mention', 'dm', 'keyword'])
      .optional()
      .describe('For create: what to watch'),
    channelId: z.string().optional().describe('Resolved channel ID (C…) for channel/keyword watches'),
    channelName: z.string().optional().describe('Human channel name like #incidents, for alerts'),
    keyword: z.string().optional().describe('For keyword watches: the word/phrase to match'),
    instructions: z.string().optional().describe('What sir wants done when this fires'),
    createdBy: z.string().optional().describe('Your agent name (e.g. dexter, echo)'),
    id: z.string().optional().describe('For remove: the subscription id')
  }),
  execute: async ({ action, matchType, channelId, channelName, keyword, instructions, createdBy, id }) => {
    try {
      if (action === 'list') {
        return { success: true, subscriptions: loadSubscriptions() }
      }
      if (action === 'remove') {
        if (!id) return { success: false, error: 'id is required to remove a subscription' }
        return { success: removeSubscription(id), removed: id }
      }
      // create
      if (!matchType) return { success: false, error: 'matchType is required to create' }
      let match: SubscriptionMatch
      if (matchType === 'channel') {
        if (!channelId) return { success: false, error: 'channelId is required for a channel watch' }
        match = { type: 'channel', channelId, channelName }
      } else if (matchType === 'keyword') {
        if (!keyword) return { success: false, error: 'keyword is required for a keyword watch' }
        match = { type: 'keyword', keyword, channelId, channelName }
      } else {
        match = { type: matchType }
      }
      const sub = addSubscription({ source: 'slack', match, instructions, createdBy: createdBy ?? 'agent' })
      return { success: true, subscription: sub }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  }
})
