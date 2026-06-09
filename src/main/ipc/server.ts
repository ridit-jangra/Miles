import { ipcMain, app } from 'electron'
import { START_SERVER } from '../../shared/channels'
import { startServer } from '../../core/server/start-server'
import path from 'path'

ipcMain.handle(START_SERVER, async () => {
  const echoDir = path.join(app.getAppPath())
  console.log('echo dir', echoDir)
  startServer(echoDir)
})
