import { generateText } from 'ai'
import { getModel } from '../ai/utils/model'
import type { EventAlert } from '../../shared/events'

const SYSTEM =
  'You are Echo, sir\'s voice assistant. Give a single short, natural spoken heads-up about a Slack notification — one casual sentence, like a friend nudging him. Do NOT read the message verbatim or use quotes; just let him know something came in and (only if it fits) hint you can help. Keep it under 20 words.'

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
