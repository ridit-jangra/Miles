type SpeakFn = (text: string) => void

let emit: SpeakFn | null = null

export function setSpeechEmitter(fn: SpeakFn): void {
  emit = fn
}

export function say(text: string): void {
  const trimmed = text?.trim()
  if (trimmed && emit) emit(trimmed)
}
