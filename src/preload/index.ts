import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { CHAT, CHAT_CHUNK, CHAT_STREAM, SPEAK, START_SERVER, TRANSCRIBE } from '../shared/channels'

const server = {
  transcribe: (audioBuffer: ArrayBuffer): Promise<{ success: boolean; text: string }> =>
    ipcRenderer.invoke(TRANSCRIBE, audioBuffer),

  speak: (text: string): Promise<{ success: boolean; audio: ArrayBuffer | null }> =>
    ipcRenderer.invoke(SPEAK, text),

  start: (): Promise<void> => ipcRenderer.invoke(START_SERVER)
}

const ai = {
  chat: (text: string) => ipcRenderer.invoke(CHAT, text),
  chatStream: (text: string): Promise<string> => ipcRenderer.invoke(CHAT_STREAM, text),

  onChunk: (cb: (delta: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, delta: string): void => cb(delta)
    ipcRenderer.on(CHAT_CHUNK, handler)
    return () => ipcRenderer.removeListener(CHAT_CHUNK, handler)
  }
}

try {
  contextBridge.exposeInMainWorld('electron', electronAPI)
  contextBridge.exposeInMainWorld('server', server)
  contextBridge.exposeInMainWorld('ai', ai)
} catch (error) {
  console.error(error)
}
