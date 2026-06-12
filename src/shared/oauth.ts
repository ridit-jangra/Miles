export type GithubDeviceStart = {
  deviceCode: string
  userCode: string

  verificationUri: string

  interval: number

  expiresIn: number
}

export type SlackOAuthResult = {
  botToken: string
  teamId: string
}

export const SLACK_REDIRECT_PORT = 8123
export const SLACK_REDIRECT_URI = `https://localhost:${SLACK_REDIRECT_PORT}/slack/callback`
