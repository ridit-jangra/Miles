import { readFileSync, writeFileSync, existsSync } from 'fs'
import { MCP_CONFIG_FILE } from '../ai/utils/env'
import type { MCPServerConfig } from '../../shared/mcp'

export function loadConfigs(): MCPServerConfig[] {
  if (!existsSync(MCP_CONFIG_FILE)) return []
  try {
    const raw = readFileSync(MCP_CONFIG_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as MCPServerConfig[]
  } catch (err) {
    console.error('[MCP] failed to read config file:', err)
    return []
  }
}

export function saveConfigs(configs: MCPServerConfig[]): void {
  writeFileSync(MCP_CONFIG_FILE, JSON.stringify(configs, null, 2), 'utf-8')
}
