export type SubagentResult = {
  agent: string
  task: string
  result: string
  ok: boolean
}

export type SubagentRun = {
  id: string
  agent: string
  task: string
  status: 'running' | 'done' | 'failed'
  startedAt: number
  updatedAt: number
  finishedAt?: number
  lastActivity: string
  lastCheckupAt: number
}

const pending: SubagentResult[] = []
const runs = new Map<string, SubagentRun>()

const ACTIVITY_TAIL = 400
const FINISHED_RETENTION_MS = 5 * 60_000

export function recordSubagentResult(result: SubagentResult): void {
  pending.push(result)
}

export function drainSubagentResults(): SubagentResult[] {
  return pending.splice(0, pending.length)
}

export function startSubagentRun(agent: string, task: string): string {
  const id = crypto.randomUUID()
  const now = Date.now()
  runs.set(id, {
    id,
    agent,
    task,
    status: 'running',
    startedAt: now,
    updatedAt: now,
    lastActivity: '',
    lastCheckupAt: now
  })
  return id
}

export function appendSubagentActivity(id: string, delta: string): void {
  const run = runs.get(id)
  if (!run || !delta) return
  run.lastActivity = (run.lastActivity + delta).slice(-ACTIVITY_TAIL)
  run.updatedAt = Date.now()
}

export function completeSubagentRun(id: string, ok: boolean): void {
  const run = runs.get(id)
  if (!run) return
  run.status = ok ? 'done' : 'failed'
  run.finishedAt = Date.now()
  run.updatedAt = run.finishedAt
}

export function markSubagentCheckedUp(id: string): void {
  const run = runs.get(id)
  if (run) run.lastCheckupAt = Date.now()
}

export function getSubagentRun(id: string): SubagentRun | undefined {
  return runs.get(id)
}

export function listSubagentRuns(): SubagentRun[] {
  const cutoff = Date.now() - FINISHED_RETENTION_MS
  for (const [id, run] of runs) {
    if (run.status !== 'running' && (run.finishedAt ?? 0) < cutoff) runs.delete(id)
  }
  return [...runs.values()].sort((a, b) => b.updatedAt - a.updatedAt)
}
