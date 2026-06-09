import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { SPEAK, TRANSCRIBE } from '../shared/channels'

const server = {
  transcribe: (audioBuffer: ArrayBuffer): Promise<{ success: boolean; text: string }> =>
    ipcRenderer.invoke(TRANSCRIBE, audioBuffer),

  speak: (text: string): Promise<{ success: boolean; audio: ArrayBuffer | null }> =>
    ipcRenderer.invoke(SPEAK, text)
}

try {
  contextBridge.exposeInMainWorld('electron', electronAPI)
  contextBridge.exposeInMainWorld('server', server)
} catch (error) {
  console.error(error)
}
