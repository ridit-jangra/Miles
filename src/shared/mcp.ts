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

/** A server definition without its generated id — the shape callers provide when adding. */
export type MCPServerInput = MCPStdioConfig | MCPRemoteConfig

/** Fields that may be patched on an existing server. */
export type MCPServerUpdate = Partial<MCPStdioConfig> | Partial<MCPRemoteConfig>

/** A fully persisted server, including its id. The union is preserved across the `& { id }`. */
export type MCPServerConfig = MCPServerInput & { id: string }

export type MCPConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error'

export type MCPServerState = MCPServerConfig & {
  status: MCPConnectionStatus
  tools: string[]
  error?: string
}
