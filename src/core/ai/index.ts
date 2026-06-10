import { runLLM } from './utils/llm'
import { createSession, Session } from './utils/session'
import { getChatSystemPrompt } from './utils/systemPrompt'
import { chatTools } from './utils/tools'

const session = createSession()

export async function chat(prompt: string): Promise<{ text: string; session: Session }> {
  return await runLLM({
    prompt,
    system: await getChatSystemPrompt(),
    // maxTokens: 60,
    // temperature: 0.3,
    // store: buildStore(),
    tools: chatTools,
    session
  })
}
