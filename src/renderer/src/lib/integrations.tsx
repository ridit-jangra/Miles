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

const NotionIcon = (): React.ReactNode =>
  iconWrap(
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952l1.448.327s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.215-1.632z" />
    </svg>
  )

const LinearIcon = (): React.ReactNode =>
  iconWrap(
    <svg viewBox="0 0 100 100" width="22" height="22" fill="currentColor">
      <path d="M1.225 61.523c-.222-.949.908-1.55 1.597-.861l36.516 36.517c.689.689.088 1.819-.861 1.597C20.012 94.36 5.639 79.988 1.225 61.523zM.001 46.726a.99.99 0 0 0 .29.749l52.234 52.234a.99.99 0 0 0 .749.29 50.1 50.1 0 0 0 6.193-.766c.789-.143 1.067-1.117.499-1.685L2.453 40.034c-.568-.568-1.542-.29-1.685.499A50.1 50.1 0 0 0 .001 46.726zm3.585-17.439a.99.99 0 0 0 .203 1.114l65.81 65.81a.99.99 0 0 0 1.114.203 49.8 49.8 0 0 0 4.969-2.65c.631-.382.724-1.26.198-1.785L8.021 24.119c-.526-.526-1.404-.433-1.785.198a49.8 49.8 0 0 0-2.65 4.97zm8.564-13.243c-.376-.376-.394-.974-.037-1.37C21.764 5.522 35.224 0 49.999 0 77.613 0 100 22.386 100 50c0 14.775-5.522 28.235-14.604 38.469-.396.357-.994.339-1.37-.037L12.15 16.044z" />
    </svg>
  )

// ---- the catalog -----------------------------------------------------------
//
// Every app is an official `@modelcontextprotocol/server-*` package launched
// with `npx`. Connecting just collects the secret each one needs and hands a
// ready MCPServerInput to the MCP manager.

export const CATALOG: CatalogApp[] = [
  {
    id: 'slack',
    name: 'Slack',
    description: 'Read channels, post messages, and search your workspace.',
    icon: <SlackIcon />,
    helpUrl: 'https://api.slack.com/apps',
    fields: [
      {
        key: 'SLACK_BOT_TOKEN',
        label: 'Bot User OAuth Token',
        placeholder: 'xoxb-...',
        secret: true
      },
      { key: 'SLACK_TEAM_ID', label: 'Team / Workspace ID', placeholder: 'T01234567' }
    ],
    build: (v) => ({
      name: 'Slack',
      description: 'Slack workspace',
      enabled: true,
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-slack'],
      env: {
        SLACK_BOT_TOKEN: v.SLACK_BOT_TOKEN,
        SLACK_USER_TOKEN: v.SLACK_USER_TOKEN,
        SLACK_TEAM_ID: v.SLACK_TEAM_ID
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
    id: 'notion',
    name: 'Notion',
    description: 'Search pages and databases and create new content.',
    icon: <NotionIcon />,
    helpUrl: 'https://www.notion.so/my-integrations',
    fields: [
      {
        key: 'NOTION_TOKEN',
        label: 'Internal integration token',
        placeholder: 'ntn_...',
        secret: true
      }
    ],
    build: (v) => ({
      name: 'Notion',
      description: 'Notion workspace',
      enabled: true,
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@notionhq/notion-mcp-server'],
      env: {
        OPENAPI_MCP_HEADERS: JSON.stringify({
          Authorization: `Bearer ${v.NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28'
        })
      }
    })
  },
  {
    id: 'linear',
    name: 'Linear',
    description: 'Track issues, projects, and cycles from your team.',
    icon: <LinearIcon />,
    helpUrl: 'https://linear.app/settings/api',
    fields: [{ key: 'LINEAR_API_KEY', label: 'API key', placeholder: 'lin_api_...', secret: true }],
    build: (v) => ({
      name: 'Linear',
      description: 'Linear workspace',
      enabled: true,
      transport: 'stdio',
      command: 'npx',
      args: ['-y', 'mcp-remote', 'https://mcp.linear.app/sse'],
      env: { LINEAR_API_KEY: v.LINEAR_API_KEY }
    })
  }
]
