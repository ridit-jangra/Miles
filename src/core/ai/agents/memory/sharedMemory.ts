export const sharedMemory = {
  toolCalls: new Map<
    string,
    { agent: string; input?: unknown; result: unknown; timestamp: Date }
  >(),

  record(agent: string, toolName: string, result: unknown) {
    const key = `${toolName}:${JSON.stringify(result)}`
    this.toolCalls.set(key, { agent, result, timestamp: new Date() })
  },

  hasBeenCalled(toolName: string, input: unknown): boolean {
    const key = `${toolName}:${JSON.stringify(input)}`
    return this.toolCalls.has(key)
  },

  getResult(toolName: string, input: unknown) {
    const key = `${toolName}:${JSON.stringify(input)}`
    return this.toolCalls.get(key)
  },

  getSummary(): string {
    if (this.toolCalls.size === 0) return 'No tool calls yet.'
    return [...this.toolCalls.entries()]
      .map(
        ([key, v]) =>
          `[${v.agent}] ${key.split(':')[0]} → ${JSON.stringify(v.input ?? {}).slice(0, 100)}`
      )
      .join('\n')
  }
}
