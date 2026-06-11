import { createMCPClient, type MCPClient } from '@ai-sdk/mcp'
import { Experimental_StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio'
import type { ToolSet } from 'ai'
import { loadConfigs, saveConfigs } from './store'
import type {
  MCPConnectionStatus,
  MCPServerConfig,
  MCPServerInput,
  MCPServerState,
  MCPServerUpdate
} from '../../shared/mcp'

type LiveServer = {
  config: MCPServerConfig
  client?: MCPClient
  tools: ToolSet
  status: MCPConnectionStatus
  toolNames: string[]
  error?: string
}

/**
 * Owns every configured MCP server, its persisted config, and (when connected)
 * its live client and exposed tools. Runs in the Electron main process — stdio
 * servers spawn child processes, so this must not run in the renderer.
 */
class MCPManager {
  private servers = new Map<string, LiveServer>()
  private loaded = false

  private ensureLoaded(): void {
    if (this.loaded) return
    for (const config of loadConfigs()) {
      this.servers.set(config.id, {
        config,
        tools: {},
        status: 'disconnected',
        toolNames: []
      })
    }
    this.loaded = true
  }

  /** Connect every enabled server. Called once on app startup. */
  async init(): Promise<void> {
    this.ensureLoaded()
    await Promise.all(
      [...this.servers.values()]
        .filter((s) => s.config.enabled)
        .map((s) => this.connect(s.config.id).catch(() => undefined))
    )
  }

  private persist(): void {
    saveConfigs([...this.servers.values()].map((s) => s.config))
  }

  /** Prefix MCP tool names so they never collide with built-in or sibling tools. */
  private prefixFor(config: MCPServerConfig): string {
    const slug = config.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
    return `mcp__${slug || config.id.slice(0, 8)}__`
  }

  async connect(id: string): Promise<MCPServerState> {
    this.ensureLoaded()
    const server = this.servers.get(id)
    if (!server) throw new Error(`MCP server ${id} not found`)

    await this.closeClient(server)
    server.status = 'connecting'
    server.error = undefined

    try {
      const { config } = server
      const client = await createMCPClient({
        transport:
          config.transport === 'stdio'
            ? new Experimental_StdioMCPTransport({
                command: config.command,
                args: config.args,
                env: config.env
              })
            : { type: config.transport, url: config.url, headers: config.headers }
      })

      const rawTools = await client.tools()
      const prefix = this.prefixFor(config)
      const tools: ToolSet = {}
      for (const [name, tool] of Object.entries(rawTools)) {
        tools[`${prefix}${name}`] = tool
      }

      server.client = client
      server.tools = tools
      server.toolNames = Object.keys(rawTools)
      server.status = 'connected'
    } catch (err) {
      server.status = 'error'
      server.error = err instanceof Error ? err.message : String(err)
      server.tools = {}
      server.toolNames = []
    }

    return this.toState(server)
  }

  async disconnect(id: string): Promise<MCPServerState> {
    this.ensureLoaded()
    const server = this.servers.get(id)
    if (!server) throw new Error(`MCP server ${id} not found`)
    await this.closeClient(server)
    server.status = 'disconnected'
    server.error = undefined
    return this.toState(server)
  }

  private async closeClient(server: LiveServer): Promise<void> {
    if (!server.client) return
    try {
      await server.client.close()
    } catch (err) {
      console.error(`[MCP] error closing ${server.config.id}:`, err)
    }
    server.client = undefined
    server.tools = {}
  }

  async add(config: MCPServerInput): Promise<MCPServerState> {
    this.ensureLoaded()
    const full = { ...config, id: crypto.randomUUID() } as MCPServerConfig
    this.servers.set(full.id, {
      config: full,
      tools: {},
      status: 'disconnected',
      toolNames: []
    })
    this.persist()
    if (full.enabled) return this.connect(full.id)
    return this.toState(this.servers.get(full.id)!)
  }

  async update(id: string, patch: MCPServerUpdate): Promise<MCPServerState> {
    this.ensureLoaded()
    const server = this.servers.get(id)
    if (!server) throw new Error(`MCP server ${id} not found`)
    server.config = { ...server.config, ...patch } as MCPServerConfig
    this.persist()

    if (server.config.enabled) return this.connect(id)
    await this.disconnect(id)
    return this.toState(server)
  }

  async remove(id: string): Promise<void> {
    this.ensureLoaded()
    const server = this.servers.get(id)
    if (!server) return
    await this.closeClient(server)
    this.servers.delete(id)
    this.persist()
  }

  /** Merged ToolSet across all connected servers, for the LLM. */
  getTools(): ToolSet {
    this.ensureLoaded()
    const all: ToolSet = {}
    for (const server of this.servers.values()) {
      if (server.status === 'connected') Object.assign(all, server.tools)
    }
    return all
  }

  list(): MCPServerState[] {
    this.ensureLoaded()
    return [...this.servers.values()].map((s) => this.toState(s))
  }

  private toState(server: LiveServer): MCPServerState {
    return {
      ...server.config,
      status: server.status,
      tools: server.toolNames,
      error: server.error
    }
  }

  async shutdown(): Promise<void> {
    await Promise.all([...this.servers.values()].map((s) => this.closeClient(s)))
  }
}

export const mcpManager = new MCPManager()
