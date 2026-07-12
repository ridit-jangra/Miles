type SpeakFn = (text: string, listen: boolean) => void

let emit: SpeakFn | null = null

export function setSpeechEmitter(fn: SpeakFn): void {
  emit = fn
}

export function say(text: string, listen = false): void {
  const trimmed = text?.trim()
  if (trimmed && emit) emit(trimmed, listen)
}
