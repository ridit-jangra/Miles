/* eslint-disable react-refresh/only-export-components */
import React from 'react'
import type { MCPServerInput } from '../../../shared/mcp'

export type CredentialField = {
  key: string
  label: string
  placeholder?: string

  secret?: boolean
}

export type OAuthSpec =
  | {
      provider: 'github'

      tokenKey: string
    }
  | { provider: 'slack' }

export type CatalogApp = {
  id: string
  name: string
  description: string
  icon: React.ReactNode

  helpUrl?: string

  fields: CredentialField[]

  oauth?: OAuthSpec

  build: (values: Record<string, string>) => MCPServerInput
}

const iconWrap = (children: React.ReactNode): React.ReactNode => (
  <span className="flex items-center justify-center w-11 h-11 rounded-md bg-white/10 text-white">
    {children}
  </span>
)

const SlackIcon = (): React.ReactNode =>
  iconWrap(
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52z" />
    </svg>
  )

const GitHubIcon = (): React.ReactNode =>
  iconWrap(
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.5 11.5 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.014 2.898-.014 3.293 0 .322.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  )

const ChromeIcon = (): React.ReactNode =>
  iconWrap(
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M12 0C8.21 0 4.831 1.757 2.632 4.501l3.953 6.848A5.454 5.454 0 0 1 12 6.545h10.691A12 12 0 0 0 12 0zM1.931 5.47A11.943 11.943 0 0 0 0 12c0 6.012 4.42 10.991 10.189 11.864l3.953-6.847a5.45 5.45 0 0 1-6.865-2.29zm13.342 2.166a5.446 5.446 0 0 1 1.45 7.09l.002.001h-.002l-5.344 9.257c.206.01.413.016.621.016 6.627 0 12-5.373 12-12 0-1.54-.29-3.011-.818-4.364zM12 16.364a4.364 4.364 0 1 1 0-8.728 4.364 4.364 0 0 1 0 8.728Z" />
    </svg>
  )

export const CATALOG: CatalogApp[] = [
  {
    id: 'slack',
    name: 'Slack',
    description: 'Read channels and DMs, post messages, and search your workspace.',
    icon: <SlackIcon />,
    helpUrl: 'https://github.com/korotovsky/slack-mcp-server',
    fields: [
      {
        key: 'SLACK_USER_TOKEN',
        label: 'User OAuth Token',
        placeholder: 'xoxp-...',
        secret: true
      }
    ],
    build: (v) => ({
      name: 'Slack',
      description: 'Slack workspace',
      enabled: true,
      transport: 'stdio',
      command: 'npx',
      args: ['-y', 'slack-mcp-server'],
      env: {
        SLACK_MCP_XOXP_TOKEN: v.SLACK_USER_TOKEN,
        SLACK_USER_TOKEN: v.SLACK_USER_TOKEN
      }
    })
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Browse repos, issues, and pull requests, and open new ones.',
    icon: <GitHubIcon />,
    fields: [],
    oauth: { provider: 'github', tokenKey: 'GITHUB_PERSONAL_ACCESS_TOKEN' },
    build: (v) => ({
      name: 'GitHub',
      description: 'GitHub account',
      enabled: true,
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: { GITHUB_PERSONAL_ACCESS_TOKEN: v.GITHUB_PERSONAL_ACCESS_TOKEN }
    })
  },
  {
    id: 'chrome-devtools',
    name: 'Chrome DevTools',
    description: 'Let Echo drive a browser — navigate, click, type, scrape, and inspect pages.',
    icon: <ChromeIcon />,
    helpUrl: 'https://github.com/ChromeDevTools/chrome-devtools-mcp',
    fields: [],
    build: () => ({
      name: 'Chrome DevTools',
      description: 'Drive Chrome over the DevTools Protocol',
      enabled: true,
      transport: 'stdio',
      command: 'npx',
      args: ['-y', 'chrome-devtools-mcp@latest', '--executablePath', '/usr/bin/chromium']
    })
  }
]
