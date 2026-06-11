import { ipcMain, BrowserWindow } from 'electron'
import { CHAT, CHAT_STREAM, CHAT_CHUNK } from '../../shared/channels'
import { chat, chatStream } from '../../core/ai'

ipcMain.handle(CHAT, async (_, text: string) => {
  return (await chat(text)).text
})

ipcMain.handle(CHAT_STREAM, async (event, text: string) => {
  const win = BrowserWindow.fromWebContents(event.sender)

  const result = await chatStream(text, (delta: string) => {
    if (win && !win.isDestroyed()) {
      event.sender.send(CHAT_CHUNK, delta)
    }
  })

  return result.text
})
