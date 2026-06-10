export async function speak(text: string, onEnded?: () => void): Promise<HTMLAudioElement | void> {
  try {
    const tts = await window.server.speak(text)
    if (!tts.success || !tts.audio) {
      console.warn('[speak] no audio returned')
      onEnded?.()
      return
    }

    const audioBlob = new Blob([tts.audio], { type: 'audio/wav' })
    const url = URL.createObjectURL(audioBlob)
    const audio = new Audio(url)

    audio.onended = () => {
      URL.revokeObjectURL(url)
      onEnded?.()
    }

    audio.onerror = (e) => {
      console.error('[speak] audio error:', e)
      URL.revokeObjectURL(url)
      onEnded?.()
    }

    try {
      await audio.play()
    } catch (e) {
      console.error('[speak] play failed:', e)
      URL.revokeObjectURL(url)
      onEnded?.()
    }

    return audio
  } catch (e) {
    console.error('[speak] failed:', e)
    onEnded?.()
  }
}
