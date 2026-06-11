import { ElectronAPI } from '@electron-toolkit/preload'
import type { MCPServerInput, MCPServerState, MCPServerUpdate } from '../shared/mcp'
import type { GithubDeviceStart } from '../shared/oauth'

type server_api = {
  transcribe: (buffer: ArrayBuffer) => Promise<{
    success: boolean
    text: string
  }>
  speak: (text: string) => Promise<{
    success: boolean
    audio: BlobPart
  }>
  start: () => Promise<void>
}

type ai_api = {
  chat: (text: string) => Promise<string>
  chatStream: (text: string) => Promise<string>
  onChunk: (cb: (delta: string) => void) => () => void
}

type mcp_api = {
  list: () => Promise<MCPServerState[]>
  add: (config: MCPServerInput) => Promise<MCPServerState>
  update: (id: string, patch: MCPServerUpdate) => Promise<MCPServerState>
  remove: (id: string) => Promise<void>
  connect: (id: string) => Promise<MCPServerState>
  disconnect: (id: string) => Promise<MCPServerState>
}

type oauth_api = {
  githubStart: () => Promise<GithubDeviceStart>
  githubPoll: (deviceCode: string, interval: number) => Promise<string>
}

declare global {
  interface Window {
    electron: ElectronAPI
    server: server_api
    ai: ai_api
    mcp: mcp_api
    oauth: oauth_api
    speak: { onSay: (cb: (text: string) => void) => () => void }
  }
}

export type { MCPServerInput, MCPServerState, MCPServerUpdate, GithubDeviceStart }
