import type { Briefing } from '../../../shared/briefing'

type Period = 'morning' | 'afternoon' | 'evening' | 'night'

const GREETINGS: Record<Period, string[]> = {
  morning: ['Good morning.', 'Morning. Ready when you are.', "Morning — let's get started."],
  afternoon: ['Good afternoon.', 'Afternoon. Back at it.', 'Afternoon — what do you need?'],
  evening: ['Good evening.', 'Evening. Still going strong.', 'Evening — how can I help?'],
  night: ['Working late, I see.', "Still up? I'm here.", 'Late one tonight. What do you need?']
}

const QUIET_SNIPPETS = [
  'Nothing pressing right now.',
  'All clear on Slack and GitHub.',
  'Your queue is empty. Good time to focus.',
  'No reviews or mentions waiting.'
]

const LOADING_SNIPPETS = [
  'One moment, checking things.',
  'Let me pull that up.',
  'Just a sec, looking now.',
  'Give me a moment.',
  'Checking your channels.'
]

const AWAKE_SNIPPETS = ["I'm here. What do you need?", 'Ready when you are.', 'I am awake sir.']

const GREETED_KEY = 'wake:lastGreetedDate'

function getPeriod(): Period {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return 'morning'
  if (h >= 12 && h < 17) return 'afternoon'
  if (h >= 17 && h < 21) return 'evening'
  return 'night'
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

function shortRepo(repo: string): string {
  return repo || 'a repo'
}

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)]
}

function listJoin(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

function alreadyGreetedToday(): boolean {
  try {
    return localStorage.getItem(GREETED_KEY) === todayKey()
  } catch {
    return false
  }
}

function markGreetedToday(): void {
  try {
    localStorage.setItem(GREETED_KEY, todayKey())
  } catch {
    // ignore (private mode / storage disabled)
  }
}

function clausesFor(briefing: Briefing): string[] {
  const clauses: string[] = []
  const gh = briefing.github
  const slack = briefing.slack

  if (gh?.reviewRequests) {
    const prs = gh.reviewPrs ?? []
    if (prs.length === 1) {
      const pr = prs[0]
      const title = pr.title ? ` — “${pr.title}”` : ''
      clauses.push(`a PR on ${shortRepo(pr.repo)} needs your review${title}`)
    } else if (prs.length > 1) {
      const repos = uniq(prs.map((p) => shortRepo(p.repo))).slice(0, 3)
      clauses.push(`${plural(prs.length, 'PR')} need your review, on ${listJoin(repos)}`)
    } else {
      clauses.push(`${plural(gh.reviewRequests, 'PR')} waiting on your review`)
    }
  }
  if (slack?.mentions) {
    clauses.push(`${plural(slack.mentions, 'mention')} on Slack today`)
  }
  if (slack?.unreadDms) {
    const who = slack.topDmFrom ? `, the latest from ${slack.topDmFrom}` : ''
    clauses.push(`${plural(slack.unreadDms, 'unread DM')}${who}`)
  }
  if (gh?.newStars) {
    const where = gh.starRepo ? ` on ${gh.starRepo.split('/').pop()}` : ''
    clauses.push(`${plural(gh.newStars, 'new star')}${where}`)
  }
  if (gh?.openPrs && !gh.reviewRequests) {
    const prs = gh.openPrList ?? []
    if (prs.length === 1) {
      const pr = prs[0]
      const title = pr.title ? ` — “${pr.title}”` : ''
      clauses.push(`your PR on ${shortRepo(pr.repo)} is still in flight${title}`)
    } else if (prs.length > 1) {
      const repos = uniq(prs.map((p) => shortRepo(p.repo))).slice(0, 3)
      clauses.push(
        `${plural(prs.length, 'open PR')} of yours still in flight, on ${listJoin(repos)}`
      )
    } else {
      clauses.push(`${plural(gh.openPrs, 'open PR')} of yours still in flight`)
    }
  }

  return clauses
}

function summarize(clauses: string[]): string {
  const top = clauses.slice(0, 3)
  if (top.length === 1) return capitalize(`${top[0]}.`)
  const head = top.slice(0, -1).join(', ')
  return capitalize(`${head} and ${top[top.length - 1]}.`)
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export type WakeGreeting = {
  salute: string
  loading: string
  brief: Promise<string>
}

export function buildWakeGreeting(): WakeGreeting {
  const greetedToday = alreadyGreetedToday()
  const salute = greetedToday ? pick(AWAKE_SNIPPETS) : pick(GREETINGS[getPeriod()])
  if (!greetedToday) markGreetedToday()

  const loading = pick(LOADING_SNIPPETS)

  const brief = (async () => {
    try {
      const briefing = await window.briefing.get()
      const clauses = clausesFor(briefing)
      if (clauses.length) return summarize(clauses)
    } catch (err) {
      void err
    }
    return pick(QUIET_SNIPPETS)
  })()

  return { salute, loading, brief }
}
