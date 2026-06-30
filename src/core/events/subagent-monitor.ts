import { listSubagentRuns, getSubagentRun, markSubagentCheckedUp } from './subagents'
import { narrateSubagentCheckup } from './narrate'
import { say } from './speech'

const TICK_MS = 20_000
const FIRST_CHECKUP_MS = 90_000
const REPEAT_CHECKUP_MS = 120_000

export function startSubagentMonitor(): () => void {
  let stopped = false

  const tick = async (): Promise<void> => {
    if (stopped) return
    const now = Date.now()
    for (const run of listSubagentRuns()) {
      if (run.status !== 'running') continue
      const age = now - run.startedAt
      const sinceCheckup = now - run.lastCheckupAt
      const due =
        age >= FIRST_CHECKUP_MS && (run.lastCheckupAt === run.startedAt || sinceCheckup >= REPEAT_CHECKUP_MS)
      if (!due) continue
      markSubagentCheckedUp(run.id)
      try {
        const line = await narrateSubagentCheckup(run.agent, run.task, run.lastActivity)
        if (getSubagentRun(run.id)?.status === 'running') say(line)
      } catch (err) {
        console.error('[subagent-monitor] checkup failed:', err)
      }
    }
  }

  const timer = setInterval(() => void tick(), TICK_MS)
  return () => {
    stopped = true
    clearInterval(timer)
  }
}
