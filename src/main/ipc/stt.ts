import { ipcMain } from 'electron'
import { TRANSCRIBE } from '../../shared/channels'
import { SERVER_PORT, SERVER_URL } from '../../shared/constants'

ipcMain.handle(TRANSCRIBE, async (_, audioBuffer: ArrayBuffer) => {
  try {
    const formData = new FormData()
    const blob = new Blob([audioBuffer], { type: 'audio/webm' })
    formData.append('file', blob, 'audio.webm')

    const res = await fetch(`${SERVER_URL}:${SERVER_PORT}/transcribe`, {
      method: 'POST',
      body: formData
    })

    if (!res.ok) throw new Error(`STT server error: ${res.status}`)
    const data = (await res.json()) as { text: string }
    return { success: true, text: data.text }
  } catch (err) {
    console.error('STT error:', err)
    return { success: false, text: '' }
  }
})
