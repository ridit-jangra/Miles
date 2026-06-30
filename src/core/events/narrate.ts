import { generateText } from 'ai'
import { getModel } from '../ai/utils/model'
import type { EventAlert } from '../../shared/events'

const SYSTEM =
  'You are Echo, sir\'s voice assistant. Give a single short, natural spoken heads-up about a Slack notification — one casual sentence, like a friend nudging him. Do NOT read the message verbatim or use quotes; just let him know something came in and (only if it fits) hint you can help. Keep it under 20 words.'

const SUBAGENT_SYSTEM =
  "You are Echo, sir's voice assistant. A background helper you delegated to just finished. Confirm the outcome to sir in ONE short, natural spoken sentence — plain English, no markdown, lists, code, urls, or file paths. State only the result, not the process or the steps taken. For a simple action just confirm it's done in a few words (e.g. 'Done, music's stopped.'). Don't pad it."

export async function narrateSubagentResult(
  agent: string,
  task: string,
  result: string
): Promise<string> {
  try {
    const { model } = await getModel()
    const res = await generateText({
      model,
      system: SUBAGENT_SYSTEM,
      prompt: `${agent} was asked to: ${task}\n\nIts result:\n${result}\n\nTell sir what came of it.`
    })
    return res.text.trim() || `${agent} finished that for you, sir.`
  } catch {
    return `${agent} finished that for you, sir.`
  }
}

export async function narrateAlert(alert: EventAlert): Promise<string> {
  const where = alert.channelName ?? 'a channel'
  const detail =
    alert.count && alert.count > 1
      ? `${alert.count} new messages in ${where}. The latest is: ${alert.text ?? ''}`
      : `a new message in ${where}: ${alert.text ?? ''}`
  try {
    const { model } = await getModel()
    const res = await generateText({
      model,
      system: SYSTEM,
      prompt: `Give sir a heads-up about ${detail}`
    })
    return res.text.trim() || alert.summary
  } catch {
    return alert.summary
  }
}
