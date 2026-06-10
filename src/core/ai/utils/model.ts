import { buildProvider } from './providers'
import type { LanguageModel } from 'ai'
import type { ProviderConfig } from './providers'

export async function getModel(): Promise<{
  model: LanguageModel
  modelId: string
  config: ProviderConfig
}> {
  const config: ProviderConfig = {
    model: 'openai/gpt-oss-20b',
    name: 'gpt-oss-20b',
    provider: 'groq',
    apiKey: process.env.GROQ_API_KEY
  }
  if (!config) {
    throw new Error('no provider configured — run /provider add to get started 🐱')
  }
  return {
    model: buildProvider(config),
    modelId: `${config.name} · ${config.model}`,
    config
  }
}
