export type SubscriptionMatch =
  | { type: 'channel'; channelId: string; channelName?: string }
  | { type: 'mention' }
  | { type: 'dm' }
  | { type: 'keyword'; keyword: string; channelId?: string; channelName?: string }

export type Subscription = {
  id: string
  source: 'slack'
  match: SubscriptionMatch
  instructions?: string
  createdBy: string
  createdAt: string
}

export type SubscriptionInput = Omit<Subscription, 'id' | 'createdAt'>

export type EventAlert = {
  id: string
  subscriptionId: string
  source: 'slack'
  summary: string
  count?: number
  channelId?: string
  channelName?: string
  user?: string
  userName?: string
  text?: string
  ts?: string
  receivedAt: string
}
