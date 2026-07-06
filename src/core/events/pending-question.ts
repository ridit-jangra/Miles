import { say } from './speech'

type Pending = {
  id: string
  question: string
  resolve: (answer: string) => void
  timer: ReturnType<typeof setTimeout>
}

const queue: Pending[] = []
const TIMEOUT_MS = 4 * 60_000
const NO_ANSWER = '(No answer from sir — proceed using your best judgment.)'

export function hasPendingQuestion(): boolean {
  return queue.length > 0
}

export function askEcho(question: string, signal?: AbortSignal): Promise<string> {
  return new Promise<string>((resolve) => {
    if (signal?.aborted) {
      resolve(NO_ANSWER)
      return
    }
    const id = crypto.randomUUID()
    const withdraw = (): void => {
      const idx = queue.findIndex((q) => q.id === id)
      if (idx === -1) return
      const [p] = queue.splice(idx, 1)
      clearTimeout(p.timer)
      p.resolve(NO_ANSWER)
      if (idx === 0 && queue.length > 0) say(queue[0].question)
    }
    const timer = setTimeout(withdraw, TIMEOUT_MS)
    signal?.addEventListener('abort', withdraw, { once: true })

    const wasEmpty = queue.length === 0
    queue.push({ id, question, resolve, timer })
    if (wasEmpty) say(question)
  })
}

export function answerPendingQuestion(answer: string): boolean {
  const p = queue.shift()
  if (!p) return false
  clearTimeout(p.timer)
  p.resolve(answer)
  if (queue.length > 0) say(queue[0].question)
  return true
}
