import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { SPEAK, START_SERVER, TRANSCRIBE } from '../shared/channels'

const server = {
  transcribe: (audioBuffer: ArrayBuffer): Promise<{ success: boolean; text: string }> =>
    ipcRenderer.invoke(TRANSCRIBE, audioBuffer),

  speak: (text: string): Promise<{ success: boolean; audio: ArrayBuffer | null }> =>
    ipcRenderer.invoke(SPEAK, text),

  start: (): Promise<void> => ipcRenderer.invoke(START_SERVER)
}

try {
  contextBridge.exposeInMainWorld('electron', electronAPI)
  contextBridge.exposeInMainWorld('server', server)
} catch (error) {
  console.error(error)
}
