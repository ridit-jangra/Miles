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

const CONNECT_TIMEOUT_MS = 300_000

function mergedEnv(extra?: Record<string, string>): Record<string, string> {
  const base: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) base[key] = value
  }
  return { ...base, ...(extra ?? {}) }
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      }
    )
  })
}

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

    let client: MCPClient | undefined
    const startedAt = Date.now()
    console.log(`[MCP] connecting "${server.config.name}"...`)
    try {
      const { config } = server
      client = await withTimeout(
        createMCPClient({
          transport:
            config.transport === 'stdio'
              ? new Experimental_StdioMCPTransport({
                  command: config.command,
                  args: config.args,
                  env: mergedEnv(config.env),
                  stderr: 'inherit'
                })
              : { type: config.transport, url: config.url, headers: config.headers }
        }),
        CONNECT_TIMEOUT_MS,
        `Timed out after ${CONNECT_TIMEOUT_MS / 1000}s starting "${config.name}". The command may be slow to download (npx) or failing to launch.`
      )

      console.log(`[MCP] "${config.name}" process up, loading tools...`)
      const rawTools = await withTimeout(
        client.tools(),
        CONNECT_TIMEOUT_MS,
        `Timed out loading tools from "${config.name}".`
      )
      const prefix = this.prefixFor(config)
      const tools: ToolSet = {}
      for (const [name, tool] of Object.entries(rawTools)) {
        tools[`${prefix}${name}`] = tool
      }

      server.client = client
      server.tools = tools
      server.toolNames = Object.keys(rawTools)
      server.status = 'connected'
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
      console.log(
        `[MCP] "${config.name}" connected in ${elapsed}s with ${server.toolNames.length} tools`
      )
    } catch (err) {
      if (client) await client.close().catch(() => undefined)
      server.status = 'error'
      server.error = err instanceof Error ? err.message : String(err)
      server.tools = {}
      server.toolNames = []
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
      console.error(`[MCP] "${server.config.name}" failed after ${elapsed}s: ${server.error}`)
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

  getToolsByServerNames(names: string[]): ToolSet {
    this.ensureLoaded()
    const slug = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, '')
    const wanted = new Set(names.map(slug))
    const all: ToolSet = {}
    for (const server of this.servers.values()) {
      if (server.status === 'connected' && wanted.has(slug(server.config.name))) {
        Object.assign(all, server.tools)
      }
    }
    return all
  }

  async shutdown(): Promise<void> {
    await Promise.all([...this.servers.values()].map((s) => this.closeClient(s)))
  }
}

export const mcpManager = new MCPManager()
