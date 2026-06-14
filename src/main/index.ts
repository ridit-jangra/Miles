import { config } from 'dotenv'
config()

import './ipc/stt'
import './ipc/tts'
import './ipc/server'
import './ipc/ai'
import './ipc/mcp'
import './ipc/oauth'
import './ipc/briefing'
import { mcpManager } from '../core/mcp/manager'
import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { WAKE_FOCUS_WINDOW } from '../shared/channels'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
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

  ipcMain.on(WAKE_FOCUS_WINDOW, () => focusMainWindow())

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
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))

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
  mcpManager.shutdown().catch((err) => console.error('[MCP] shutdown failed:', err))
})
