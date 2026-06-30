/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs'
import { join } from 'path'
import { MCP_CONFIG_FILE, ECHO_BASE_DIR } from '../ai/utils/env'

export const STYLE_DIR = join(ECHO_BASE_DIR, 'style')
export const CORPUS_FILE = join(STYLE_DIR, 'slack-sent.jsonl')
const STATE_FILE = join(STYLE_DIR, 'slack-collector-state.json')

const POLL_INTERVAL_MS = 5 * 60_000
const PAGE_SIZE = 100
const MAX_BACKFILL_PAGES = 100
const PAGE_DELAY_MS = 3_000

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

type State = { backfillComplete: boolean; newestTs?: string }

type SentMessage = {
  ts: string
  text: string
  channelId?: string
  channelName?: string
  isPrivate?: boolean
  isIm?: boolean
  permalink?: string
}

function loadState(): State {
  if (!existsSync(STATE_FILE)) return { backfillComplete: false }
  try {
    const s = JSON.parse(readFileSync(STATE_FILE, 'utf-8'))
    return { backfillComplete: !!s.backfillComplete, newestTs: s.newestTs }
  } catch {
    return { backfillComplete: false }
  }
}

function saveState(s: State): void {
  try {
    mkdirSync(STYLE_DIR, { recursive: true })
    writeFileSync(STATE_FILE, JSON.stringify(s, null, 2), 'utf-8')
  } catch (err) {
    console.error('[style] failed to save state:', err)
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
  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (res.status === 429) {
      const retry = Number(res.headers.get('retry-after') ?? '30')
      console.log(`[style] rate limited — waiting ${retry}s (attempt ${attempt + 1})`)
      await sleep((retry + 1) * 1000)
      continue
    }
    return res.json()
  }
  return { ok: false, error: 'ratelimited' }
}

function loadSeenTs(): Set<string> {
  const seen = new Set<string>()
  if (!existsSync(CORPUS_FILE)) return seen
  try {
    for (const line of readFileSync(CORPUS_FILE, 'utf-8').split('\n')) {
      if (!line.trim()) continue
      try {
        const ts = JSON.parse(line).ts
        if (ts) seen.add(ts)
      } catch {
        // skip malformed line
      }
    }
  } catch (err) {
    console.error('[style] failed to read corpus:', err)
  }
  return seen
}

function toSentMessage(match: any): SentMessage | null {
  const text = (match?.text ?? '').trim()
  if (!match?.ts || !text) return null
  const ch = match.channel ?? {}
  return {
    ts: match.ts,
    text,
    channelId: ch.id,
    channelName: ch.name,
    isPrivate: ch.is_private,
    isIm: ch.is_im,
    permalink: match.permalink
  }
}

function appendMessages(msgs: SentMessage[]): void {
  if (!msgs.length) return
  mkdirSync(STYLE_DIR, { recursive: true })
  appendFileSync(CORPUS_FILE, msgs.map((m) => JSON.stringify(m)).join('\n') + '\n', 'utf-8')
}

async function searchPage(token: string, page: number): Promise<any> {
  return slack('search.messages', token, {
    query: 'from:me',
    count: String(PAGE_SIZE),
    sort: 'timestamp',
    sort_dir: 'desc',
    page: String(page)
  })
}

function explainSearchError(error: string): void {
  if (error === 'not_allowed_token_type' || error === 'missing_scope') {
    console.error(
      `[style] Slack search unavailable (${error}). The user token needs the search:read scope — ` +
        'reauthorize the Slack app with search:read to enable style collection.'
    )
  } else {
    console.error(`[style] search.messages error: ${error}`)
  }
}

export async function collectOnce(): Promise<void> {
  const token = getToken()
  if (!token) return

  const state = loadState()
  const seen = loadSeenTs()

  const first = await searchPage(token, 1)
  if (!first.ok) {
    explainSearchError(first.error ?? 'unknown')
    return
  }

  const paging = first.messages?.paging ?? { pages: 1 }
  const totalPages = Math.min(paging.pages ?? 1, MAX_BACKFILL_PAGES)

  let newestTs = state.newestTs
  let collected = 0

  const handleMatches = (matches: any[]): boolean => {
    const fresh: SentMessage[] = []
    for (const match of matches) {
      const msg = toSentMessage(match)
      if (!msg) continue
      if (!newestTs || Number(msg.ts) > Number(newestTs)) newestTs = msg.ts
      if (seen.has(msg.ts)) {
        if (state.backfillComplete) return true
        continue
      }
      seen.add(msg.ts)
      fresh.push(msg)
    }
    appendMessages(fresh)
    collected += fresh.length
    return false
  }

  const firstMatches = first.messages?.matches ?? []
  const reachedKnown = handleMatches(firstMatches)

  if (!state.backfillComplete && !reachedKnown) {
    let incomplete = false
    for (let page = 2; page <= totalPages; page++) {
      await sleep(PAGE_DELAY_MS)
      const res = await searchPage(token, page)
      if (!res.ok) {
        explainSearchError(res.error ?? 'unknown')
        incomplete = true
        break
      }
      handleMatches(res.messages?.matches ?? [])
      if (page % 10 === 0) {
        console.log(`[style] backfill… page ${page}/${totalPages}, ${collected} new so far`)
      }
    }
    saveState({ backfillComplete: !incomplete, newestTs })
    console.log(
      `[style] backfill ${incomplete ? 'paused — will resume on next run' : 'complete'} — collected ${collected} this run`
    )
    return
  }

  // incremental: page 1 only, unless it was entirely new
  if (state.backfillComplete && !reachedKnown && firstMatches.length === PAGE_SIZE) {
    for (let page = 2; page <= totalPages; page++) {
      const res = await searchPage(token, page)
      if (!res.ok) {
        explainSearchError(res.error ?? 'unknown')
        break
      }
      if (handleMatches(res.messages?.matches ?? [])) break
    }
  }

  saveState({ backfillComplete: state.backfillComplete || true, newestTs })
  if (collected) console.log(`[style] collected ${collected} new sent messages`)
}

export function startSlackStyleCollector(): () => void {
  let stopped = false
  const tick = async (): Promise<void> => {
    if (stopped) return
    await collectOnce().catch((e) => console.error('[style] collect cycle failed:', e))
  }
  void tick()
  const timer = setInterval(tick, POLL_INTERVAL_MS)
  return () => {
    stopped = true
    clearInterval(timer)
  }
}
