// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export async function speak(text: string, onEnded?: Function): Promise<void | HTMLAudioElement> {
  const tts = await window.server.speak(text)
  if (tts.success && tts.audio) {
    const audioBlob = new Blob([tts.audio], { type: 'audio/wav' })
    const url = URL.createObjectURL(audioBlob)
    const audio = new Audio(url)
    audio.play()

    audio.onended = () => {
      URL.revokeObjectURL(url)
      onEnded?.()
    }

    onEnded?.()

    return audio
  }
}
