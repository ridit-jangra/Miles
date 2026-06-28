import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { MCP_CONFIG_FILE, ECHO_BASE_DIR } from '../ai/utils/env'
import { loadSubscriptions } from './store'
import type { EventAlert, Subscription } from '../../shared/events'

const STATE_FILE = join(ECHO_BASE_DIR, 'events-state.json')
const POLL_INTERVAL_MS = 25_000

type State = { lastTs: Record<string, string>; selfId?: string }

function loadState(): State {
  if (!existsSync(STATE_FILE)) return { lastTs: {} }
  try {
    const s = JSON.parse(readFileSync(STATE_FILE, 'utf-8'))
    return { lastTs: s.lastTs ?? {}, selfId: s.selfId }
  } catch {
    return { lastTs: {} }
  }
}

function saveState(s: State): void {
  try {
    writeFileSync(STATE_FILE, JSON.stringify(s, null, 2), 'utf-8')
  } catch (err) {
    console.error('[events] failed to save state:', err)
  }
}

function getToken(): string | undefined {
  if (!existsSync(MCP_CONFIG_FILE)) return undefined
  try {
    const cfg = JSON.parse(readFileSync(MCP_CONFIG_FILE, 'utf-8'))
    const slack = Array.isArray(cfg) ? cfg.find((s: any) => s.name === 'Slack') : undefined
    return slack?.env?.SLACK_MCP_XOXP_TOKEN
  } catch {
    return undefined
  }
}

async function slack(method: string, token: string, params: Record<string, string>): Promise<any> {
  const url = new URL(`https://slack.com/api/${method}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  return res.json()
}

function watchedChannels(subs: Subscription[]): string[] {
  const ids = new Set<string>()
  for (const s of subs) {
    if (s.match.type === 'channel') ids.add(s.match.channelId)
    else if (s.match.type === 'keyword' && s.match.channelId) ids.add(s.match.channelId)
  }
  return [...ids]
}

function matchSubs(subs: Subscription[], channelId: string, text: string, selfId?: string): Subscription[] {
  return subs.filter((s) => {
    if (s.match.type === 'channel') return s.match.channelId === channelId
    if (s.match.type === 'keyword')
      return (
        (!s.match.channelId || s.match.channelId === channelId) &&
        text.toLowerCase().includes(s.match.keyword.toLowerCase())
      )
    if (s.match.type === 'mention') return !!selfId && text.includes(`<@${selfId}>`)
    return false
  })
}

export async function pollOnce(onAlert: (alert: EventAlert, subs: Subscription[]) => void): Promise<void> {
  const token = getToken()
  if (!token) return
  const subs = loadSubscriptions().filter((s) => s.source === 'slack')
  if (subs.length === 0) return

  const state = loadState()
  if (!state.selfId) {
    const auth = await slack('auth.test', token, {})
    if (auth.ok) state.selfId = auth.user_id
  }

  for (const channelId of watchedChannels(subs)) {
    try {
      const known = state.lastTs[channelId]
      const res = await slack('conversations.history', token, {
        channel: channelId,
        limit: '15',
        ...(known ? { oldest: known } : {})
      })
      if (!res.ok) {
        if (res.error) console.error(`[events] ${channelId}: ${res.error}`)
        continue
      }
      const msgs: any[] = (res.messages ?? []).filter((m: any) => m.ts && m.ts !== known)
      // newest ts first; sort oldest -> newest for ordered alerts
      msgs.sort((a, b) => Number(a.ts) - Number(b.ts))

      if (!known) {
        // first sight of this channel: prime, don't alert on backlog
        if (msgs.length) state.lastTs[channelId] = msgs[msgs.length - 1].ts
        continue
      }

      // collect all matched new messages this cycle, then alert ONCE per channel
      const matchedMsgs: any[] = []
      let topSub: Subscription | undefined
      for (const m of msgs) {
        state.lastTs[channelId] = m.ts
        if (m.user && m.user === state.selfId) continue // skip own messages
        if (m.subtype && m.subtype !== 'bot_message') continue // skip joins/edits/etc
        const matched = matchSubs(subs, channelId, m.text ?? '', state.selfId)
        if (!matched.length) continue
        matchedMsgs.push(m)
        if (!topSub) topSub = matched[0]
      }

      if (matchedMsgs.length && topSub) {
        const channelName =
          topSub.match.type === 'channel' && topSub.match.channelName
            ? topSub.match.channelName
            : channelId
        const count = matchedMsgs.length
        const last = matchedMsgs[matchedMsgs.length - 1]
        const summary =
          count === 1
            ? `New message in ${channelName}`
            : `${count} new messages in ${channelName}`
        const alert: EventAlert = {
          id: randomUUID(),
          subscriptionId: topSub.id,
          source: 'slack',
          summary,
          count,
          channelId,
          channelName: typeof channelName === 'string' ? channelName : undefined,
          user: last.user,
          text: last.text,
          ts: last.ts,
          receivedAt: new Date().toISOString()
        }
        onAlert(alert, [topSub])
      }
    } catch (err) {
      console.error(`[events] poll error for ${channelId}:`, err)
    }
  }

  saveState(state)
}

export function startSlackPoller(onAlert: (alert: EventAlert, subs: Subscription[]) => void): () => void {
  let stopped = false
  const tick = async (): Promise<void> => {
    if (stopped) return
    await pollOnce(onAlert).catch((e) => console.error('[events] poll cycle failed:', e))
  }
  void tick()
  const timer = setInterval(tick, POLL_INTERVAL_MS)
  return () => {
    stopped = true
    clearInterval(timer)
  }
}
