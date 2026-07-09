import { config } from 'dotenv'
config()

import './ipc/stt'
import './ipc/tts'
import { startServer, stopServer } from './ipc/server'
import { ensureBrowserLauncher } from './ipc/browser'
import './ipc/ai'
import './ipc/mcp'
import './ipc/oauth'
import './ipc/briefing'
import { mcpManager } from '../core/mcp/manager'
import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { WAKE_FOCUS_WINDOW, EVENT_ALERT, SPEAK_SAY } from '../shared/channels'
import { startSlackPoller } from '../core/events/slack-poller'
import { startSlackStyleCollector } from '../core/events/slack-style-collector'
import { startSubagentMonitor } from '../core/events/subagent-monitor'
import { startJoker } from '../core/ai/agents/custom-agents/joker/agent'
import { startArgus } from '../core/ai/agents/custom-agents/argus/agent'
import { startIris } from '../core/ai/agents/custom-agents/iris/agent'
import { startSybil } from '../core/ai/agents/custom-agents/sybil/agent'
import { startCerberus, triageAlert, collectSuppressed } from '../core/ai/agents/custom-agents/cerberus/agent'
import { startScheduler } from '../core/events/scheduler'
import { narrateAlert } from '../core/events/narrate'
import { setSpeechEmitter } from '../core/events/speech'
import { announce, markActivity, startAnnouncementFlusher } from '../core/events/announcements'
import { startBackupTimer, backupEchoStore } from '../core/ai/utils/backup'

let stopBackupTimer: (() => void) | null = null
let stopJoker: (() => void) | null = null
let stopArgus: (() => void) | null = null
let stopIris: (() => void) | null = null
let stopSybil: (() => void) | null = null
let stopCerberus: (() => void) | null = null
let stopScheduler: (() => void) | null = null
let stopAnnouncements: (() => void) | null = null

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 900,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      autoplayPolicy: 'no-user-gesture-required'
    }
  })

  function focusMainWindow(): void {
    const win = mainWindow
    if (!win || win.isDestroyed()) return

    if (win.isMinimized()) win.restore()
    if (!win.isVisible()) win.show()

    win.setAlwaysOnTop(true)
    win.show()
    win.focus()
    win.setAlwaysOnTop(false)

    if (process.platform === 'darwin') app.focus({ steal: true })
  }

  ipcMain.on(WAKE_FOCUS_WINDOW, () => {
    markActivity()
    focusMainWindow()
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  setSpeechEmitter((text) => {
    if (!mainWindow.isDestroyed()) mainWindow.webContents.send(SPEAK_SAY, text)
  })

  const stopPoller = startSlackPoller(async (alert, subs) => {
    if (mainWindow.isDestroyed()) return
    mainWindow.webContents.send(EVENT_ALERT, alert)
    const verdict = triageAlert(alert, subs)
    if (verdict.surface) announce(await narrateAlert(alert))
    else collectSuppressed(alert)
  })
  const stopStyleCollector = startSlackStyleCollector()
  const stopSubagentMonitor = startSubagentMonitor()
  mainWindow.on('closed', () => {
    stopPoller()
    stopStyleCollector()
    stopSubagentMonitor()
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))

  ensureBrowserLauncher()
  stopBackupTimer = startBackupTimer()
  stopJoker = startJoker()
  stopArgus = startArgus()
  stopIris = startIris()
  stopSybil = startSybil()
  stopCerberus = startCerberus()
  stopScheduler = startScheduler()
  stopAnnouncements = startAnnouncementFlusher()
  startServer().catch((err) => console.error('[server] start failed:', err))

  mcpManager.init().catch((err) => console.error('[MCP] init failed:', err))

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (stopBackupTimer) stopBackupTimer()
  if (stopJoker) stopJoker()
  if (stopArgus) stopArgus()
  if (stopIris) stopIris()
  if (stopSybil) stopSybil()
  if (stopCerberus) stopCerberus()
  if (stopScheduler) stopScheduler()
  if (stopAnnouncements) stopAnnouncements()
  backupEchoStore()
  stopServer()
  mcpManager.shutdown().catch((err) => console.error('[MCP] shutdown failed:', err))
})
