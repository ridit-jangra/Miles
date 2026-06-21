export type MCPTransportType = 'stdio' | 'http' | 'sse'

type MCPBase = {
  name: string
  description?: string
  enabled: boolean
}

type MCPStdioConfig = MCPBase & {
  transport: 'stdio'
  command: string
  args?: string[]
  env?: Record<string, string>
}

type MCPRemoteConfig = MCPBase & {
  transport: 'http' | 'sse'
  url: string
  headers?: Record<string, string>
}

export type MCPServerInput = MCPStdioConfig | MCPRemoteConfig

export type MCPServerUpdate = Partial<MCPStdioConfig> | Partial<MCPRemoteConfig>

export type MCPServerConfig = MCPServerInput & { id: string }

export type MCPConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error'

export type MCPServerState = MCPServerConfig & {
  status: MCPConnectionStatus
  tools: string[]
  error?: string
}
