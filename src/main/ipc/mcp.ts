import { ipcMain } from 'electron'
import {
  MCP_ADD,
  MCP_CONNECT,
  MCP_DISCONNECT,
  MCP_LIST,
  MCP_REMOVE,
  MCP_UPDATE
} from '../../shared/channels'
import { mcpManager } from '../../core/mcp/manager'
import type { MCPServerInput, MCPServerUpdate } from '../../shared/mcp'

ipcMain.handle(MCP_LIST, () => mcpManager.list())

ipcMain.handle(MCP_ADD, (_e, config: MCPServerInput) => mcpManager.add(config))

ipcMain.handle(MCP_UPDATE, (_e, id: string, patch: MCPServerUpdate) =>
  mcpManager.update(id, patch)
)

ipcMain.handle(MCP_REMOVE, (_e, id: string) => mcpManager.remove(id))

ipcMain.handle(MCP_CONNECT, (_e, id: string) => mcpManager.connect(id))

ipcMain.handle(MCP_DISCONNECT, (_e, id: string) => mcpManager.disconnect(id))
