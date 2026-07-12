import { ipcMain } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { SETTINGS_GET, SETTINGS_SET } from '../../shared/channels'
import { CONFIG_FILE } from '../../core/ai/utils/env'
import type { AppSettings } from '../../shared/settings'

const SETTING_KEYS = ['OPENROUTER_API_KEY'] as const

function loadConfig(): Record<string, string> {
  if (!existsSync(CONFIG_FILE)) return {}
  try {
    const parsed = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'))
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (err) {
    console.error('[settings] failed to read config file:', err)
    return {}
  }
}

export function applyStoredSettings(): void {
  const cfg = loadConfig()
  for (const key of SETTING_KEYS) {
    if (!process.env[key] && cfg[key]) process.env[key] = cfg[key]
  }
}

ipcMain.handle(SETTINGS_GET, (): AppSettings => {
  const cfg = loadConfig()
  return {
    OPENROUTER_API_KEY: cfg.OPENROUTER_API_KEY ?? process.env.OPENROUTER_API_KEY ?? ''
  }
})

ipcMain.handle(SETTINGS_SET, (_event, patch: Partial<AppSettings>): void => {
  const cfg = loadConfig()
  for (const key of SETTING_KEYS) {
    const value = patch[key]
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (trimmed) {
      cfg[key] = trimmed
      process.env[key] = trimmed
    } else {
      delete cfg[key]
      delete process.env[key]
    }
  }
  writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8')
})
