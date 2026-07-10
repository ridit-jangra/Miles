export async function synthesize(text: string): Promise<ArrayBuffer | null> {
  try {
    const tts = await window.server.speak(text)
    if (!tts.success || !tts.audio) {
      console.warn('[speak] no audio returned')
      return null
    }
    return tts.audio as ArrayBuffer
  } catch (e) {
    console.error('[speak] synth failed:', e)
    return null
  }
}
