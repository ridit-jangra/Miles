import { ElectronAPI } from '@electron-toolkit/preload'

type server_api = {
  transcribe: (buffer: ArrayBuffer) => Promise<{
    success: boolean
    text: string
  }>
  speak: (text: string) => Promise<{
    success: boolean
    audio: BlobPart
  }>
  start: () => Promise<void>
}

type ai_api = {
  chat: (text: string) => Promise<string>
}

declare global {
  interface Window {
    electron: ElectronAPI
    server: server_api
    ai: ai_api
  }
}
