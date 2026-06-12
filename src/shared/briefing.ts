export type PullRequest = {
  repo: string
  number: number
  title: string
}

export type GithubBriefing = {
  reviewRequests: number
  reviewPrs: PullRequest[]
  openPrs: number
  openPrList: PullRequest[]
  newStars: number
  starRepo?: string
}

export type SlackBriefing = {
  unreadDms: number
  mentions: number
  topDmFrom?: string
}

export type Briefing = {
  github?: GithubBriefing
  slack?: SlackBriefing
}
