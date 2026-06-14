export interface SpeakOptions {
  onEnded?: () => void
  onLevel?: (level: number) => void
  onProgress?: (progress: number) => void
  signal?: AbortSignal
}

export async function speak(
  text: string,
  opts: SpeakOptions = {}
): Promise<HTMLAudioElement | void> {
  const { onEnded, onLevel, onProgress, signal } = opts
  try {
    if (signal?.aborted) return
    const tts = await window.server.speak(text)
    if (signal?.aborted) return
    if (!tts.success || !tts.audio) {
      console.warn('[speak] no audio returned')
      onEnded?.()
      return
    }
    const audioBlob = new Blob([tts.audio], { type: 'audio/wav' })
    const url = URL.createObjectURL(audioBlob)
    const audio = new Audio(url)

    let audioCtx: AudioContext | null = null
    let raf = 0

    if (onLevel || onProgress) {
      audioCtx = new AudioContext()
      const source = audioCtx.createMediaElementSource(audio)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)
      source.connect(audioCtx.destination)
      const data = new Uint8Array(analyser.frequencyBinCount)

      const tick = (): void => {
        analyser.getByteFrequencyData(data)
        const volume = data.reduce((a, b) => a + b, 0) / data.length
        onLevel?.(Math.min(volume / 80, 1))

        // report progress through the clip for the caption
        if (onProgress && audio.duration > 0) {
          onProgress(Math.min(audio.currentTime / audio.duration, 1))
        }

        raf = requestAnimationFrame(tick)
      }
      tick()
    }

    const cleanup = (): void => {
      if (raf) cancelAnimationFrame(raf)
      onLevel?.(0)
      onProgress?.(1)
      audioCtx?.close()
      URL.revokeObjectURL(url)
      signal?.removeEventListener('abort', onAbort)
    }

    const onAbort = (): void => {
      audio.pause()
      cleanup()
    }

    if (signal) {
      if (signal.aborted) {
        onAbort()
        return
      }
      signal.addEventListener('abort', onAbort)
    }

    audio.onended = () => {
      cleanup()
      onEnded?.()
    }
    audio.onerror = (e) => {
      console.error('[speak] audio error:', e)
      cleanup()
      onEnded?.()
    }

    try {
      await audio.play()
    } catch (e) {
      console.error('[speak] play failed:', e)
      cleanup()
      onEnded?.()
    }
    return audio
  } catch (e) {
    console.error('[speak] failed:', e)
    onEnded?.()
  }
}
