import { ipcMain } from 'electron'
import { SPEAK } from '../../shared/channels'
import { SERVER_PORT, SERVER_URL } from '../../shared/constants'

ipcMain.handle(SPEAK, async (_, text: string) => {
  try {
    const res = await fetch(`${SERVER_URL}:${SERVER_PORT}/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    })

    if (!res.ok) throw new Error(`TTS server error: ${res.status}`)
    const arrayBuffer = await res.arrayBuffer()
    return { success: true, audio: arrayBuffer }
  } catch (err) {
    console.error('TTS error:', err)
    return { success: false, audio: null }
  }
})
