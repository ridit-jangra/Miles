import { readFileSync, writeFileSync, existsSync } from 'fs'
import { loadConfigs } from '../mcp/store'
import { BRIEFING_STATE_FILE } from '../ai/utils/env'
import type { Briefing, GithubBriefing, PullRequest, SlackBriefing } from '../../shared/briefing'

function tokenFromConfigs(key: string): string | undefined {
  for (const config of loadConfigs()) {
    if (config.transport === 'stdio') {
      const value = config.env?.[key]
      if (value) return value
    }
  }
  return undefined
}

type BriefingState = {
  stars?: Record<string, number>
}

function loadState(): BriefingState {
  if (!existsSync(BRIEFING_STATE_FILE)) return {}
  try {
    return JSON.parse(readFileSync(BRIEFING_STATE_FILE, 'utf-8')) as BriefingState
  } catch {
    return {}
  }
}

function saveState(state: BriefingState): void {
  try {
    writeFileSync(BRIEFING_STATE_FILE, JSON.stringify(state, null, 2), 'utf-8')
  } catch (err) {
    void err
  }
}

const GH_HEADERS = (token: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'Echo'
})

type GhIssueItem = {
  title: string
  number: number
  repository_url: string
  updated_at: string
}

async function ghSearchPrs(token: string, query: string): Promise<PullRequest[]> {
  const url =
    `https://api.github.com/search/issues?q=${encodeURIComponent(query)}` +
    `&sort=updated&order=desc&per_page=10`
  const res = await fetch(url, { headers: GH_HEADERS(token) })
  if (!res.ok) return []
  const json = (await res.json()) as { items?: GhIssueItem[] }
  return (json.items ?? []).map((item) => ({
    repo: item.repository_url.split('/repos/')[1] ?? '',
    number: item.number,
    title: item.title
  }))
}

async function ghStarDelta(
  token: string,
  state: BriefingState
): Promise<{ newStars: number; starRepo?: string }> {
  const repos: { full_name: string; stargazers_count: number }[] = []
  for (let page = 1; page <= 3; page++) {
    const url = `https://api.github.com/user/repos?affiliation=owner&per_page=100&page=${page}&sort=pushed`
    const res = await fetch(url, { headers: GH_HEADERS(token) })
    if (!res.ok) break
    const batch = (await res.json()) as typeof repos
    repos.push(...batch)
    if (batch.length < 100) break
  }

  const previous = state.stars ?? {}
  const current: Record<string, number> = {}
  let newStars = 0
  let starRepo: string | undefined
  let best = 0

  for (const repo of repos) {
    current[repo.full_name] = repo.stargazers_count
    const before = previous[repo.full_name]

    if (before === undefined) continue
    const gained = repo.stargazers_count - before
    if (gained > 0) {
      newStars += gained
      if (gained > best) {
        best = gained
        starRepo = repo.full_name
      }
    }
  }

  state.stars = current
  return { newStars, starRepo }
}

async function githubBriefing(state: BriefingState): Promise<GithubBriefing | undefined> {
  const token = tokenFromConfigs('GITHUB_PERSONAL_ACCESS_TOKEN')
  if (!token) return undefined

  try {
    const userRes = await fetch('https://api.github.com/user', { headers: GH_HEADERS(token) })
    if (!userRes.ok) return undefined
    const { login } = (await userRes.json()) as { login: string }

    const [reviewPrs, openPrList, stars] = await Promise.all([
      ghSearchPrs(token, `is:open is:pr review-requested:${login}`),
      ghSearchPrs(token, `is:open is:pr author:${login}`),
      ghStarDelta(token, state)
    ])

    return {
      reviewRequests: reviewPrs.length,
      reviewPrs,
      openPrs: openPrList.length,
      openPrList,
      newStars: stars.newStars,
      starRepo: stars.starRepo
    }
  } catch {
    return undefined
  }
}

async function slackCall(
  token: string,
  method: string,
  params: Record<string, string> = {}
): Promise<Record<string, unknown> | null> {
  const url = `https://slack.com/api/${method}?${new URLSearchParams(params)}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) return null
  const json = (await res.json()) as Record<string, unknown>
  return json.ok ? json : null
}

async function slackBriefing(): Promise<SlackBriefing | undefined> {
  const token = tokenFromConfigs('SLACK_USER_TOKEN')
  if (!token) return undefined

  try {
    const auth = await slackCall(token, 'auth.test')
    const userId = auth?.user_id as string | undefined
    const username = auth?.user as string | undefined

    let unreadDms = 0
    let topDmFrom: string | undefined
    let mostUnread = 0
    const ims = await slackCall(token, 'conversations.list', {
      types: 'im',
      exclude_archived: 'true',
      limit: '50'
    })
    const channels = (ims?.channels as { id: string; user?: string }[] | undefined) ?? []
    for (const im of channels) {
      const info = await slackCall(token, 'conversations.info', { channel: im.id })
      const channel = info?.channel as { unread_count_display?: number } | undefined
      const unread = channel?.unread_count_display ?? 0
      if (unread > 0) {
        unreadDms++
        if (unread > mostUnread) {
          mostUnread = unread
          topDmFrom = await slackUserName(token, im.user)
        }
      }
    }

    let mentions = 0
    if (userId) {
      const day = new Date().toISOString().slice(0, 10)
      const handle = username ? `@${username}` : `<@${userId}>`
      const search = await slackCall(token, 'search.messages', {
        query: `${handle} after:${day}`,
        count: '1'
      })
      const matches = search?.messages as { total?: number } | undefined
      mentions = matches?.total ?? 0
    }

    return { unreadDms, mentions, topDmFrom }
  } catch {
    return undefined
  }
}

async function slackUserName(token: string, userId?: string): Promise<string | undefined> {
  if (!userId) return undefined
  const info = await slackCall(token, 'users.info', { user: userId })
  const user = info?.user as { real_name?: string; profile?: { display_name?: string } } | undefined
  return user?.profile?.display_name || user?.real_name || undefined
}

export async function getBriefing(): Promise<Briefing> {
  const state = loadState()
  const [github, slack] = await Promise.all([githubBriefing(state), slackBriefing()])
  saveState(state)
  return { github, slack }
}
