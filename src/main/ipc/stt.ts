import { ipcMain } from 'electron'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { TRANSCRIBE } from '../../shared/channels'
import { SERVER_PORT, SERVER_URL } from '../../shared/constants'

ipcMain.handle(TRANSCRIBE, async (_, audioBuffer: ArrayBuffer) => {
  try {
    const tmpPath = path.join(os.tmpdir(), `echo-audio-${Date.now()}.wav`)
    fs.writeFileSync(tmpPath, Buffer.from(audioBuffer))

    const formData = new FormData()
    const blob = new Blob([fs.readFileSync(tmpPath)], { type: 'audio/wav' })
    formData.append('file', blob, 'audio.wav')

    const res = await fetch(`${SERVER_URL}:${SERVER_PORT}/transcribe`, {
      method: 'POST',
      body: formData
    })

    fs.unlinkSync(tmpPath)

    if (!res.ok) throw new Error(`STT server error: ${res.status}`)
    const data = (await res.json()) as { text: string }
    return { success: true, text: data.text }
  } catch (err) {
    console.error('STT error:', err)
    return { success: false, text: '' }
  }
})
