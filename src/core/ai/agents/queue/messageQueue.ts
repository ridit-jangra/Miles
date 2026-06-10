type QueuedMessage = {
  from: string
  message: string
  timestamp: number
}

class MessageQueue {
  private queues = new Map<string, QueuedMessage[]>()

  push(to: string, from: string, message: string): void {
    if (!this.queues.has(to)) this.queues.set(to, [])
    this.queues.get(to)!.push({ from, message, timestamp: Date.now() })
  }

  pop(name: string): QueuedMessage | null {
    return this.queues.get(name)?.shift() ?? null
  }

  peek(name: string): QueuedMessage[] {
    return this.queues.get(name) ?? []
  }

  clear(name: string): void {
    this.queues.delete(name)
  }
}

export const messageQueue = new MessageQueue()
