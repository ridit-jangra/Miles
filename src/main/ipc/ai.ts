import { ipcMain } from 'electron'
import { CHAT } from '../../shared/channels'
import { chat } from '../../core/ai/ai'

ipcMain.handle(CHAT, async (_, text: string) => {
  return (await chat(text)).text
})
