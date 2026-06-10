import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { CHAT, SPEAK, START_SERVER, TRANSCRIBE } from '../shared/channels'

const server = {
  transcribe: (audioBuffer: ArrayBuffer): Promise<{ success: boolean; text: string }> =>
    ipcRenderer.invoke(TRANSCRIBE, audioBuffer),

  speak: (text: string): Promise<{ success: boolean; audio: ArrayBuffer | null }> =>
    ipcRenderer.invoke(SPEAK, text),

  start: (): Promise<void> => ipcRenderer.invoke(START_SERVER)
}

const ai = {
  chat: (text: string) => ipcRenderer.invoke(CHAT, text)
}

try {
  contextBridge.exposeInMainWorld('electron', electronAPI)
  contextBridge.exposeInMainWorld('server', server)
  contextBridge.exposeInMainWorld('ai', ai)
} catch (error) {
  console.error(error)
}
