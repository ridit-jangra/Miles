import { tool } from 'ai'
import { z } from 'zod'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { ECHO_BASE_DIR } from '../../utils/env'
import { DESCRIPTION, PROMPT } from './prompt'

const PLAN_FILE = join(ECHO_BASE_DIR, 'plan.json')

export const PlanTool = tool({
  title: 'Plan',
  description: DESCRIPTION + '\n\n' + PROMPT,
  inputSchema: z.object({
    steps: z
      .array(
        z.object({
          step: z.string().describe('What this step accomplishes'),
          status: z.enum(['pending', 'in_progress', 'completed', 'skipped'])
        })
      )
      .describe('The full plan with every step and its current status (replaces the stored plan)')
  }),
  execute: async ({ steps }) => {
    try {
      writeFileSync(
        PLAN_FILE,
        JSON.stringify({ steps, updatedAt: new Date().toISOString() }, null, 2),
        'utf-8'
      )
    } catch {
      // non-fatal: plan tracking is best-effort
    }
    const completed = steps.filter((s) => s.status === 'completed').length
    const current = steps.find((s) => s.status === 'in_progress')?.step
    return { success: true, total: steps.length, completed, current, steps }
  }
})
