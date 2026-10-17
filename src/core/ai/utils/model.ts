import { buildProvider, withoutVision } from './providers'
import type { LanguageModel } from 'ai'
import type { ProviderConfig } from './providers'

// miles: the voice-facing orchestrator, small + fast.
// agent: subagents (dexter, hank, merlin, otto, scout) and background work.
export type ModelRole = 'miles' | 'agent'

const OLLAMA_MODELS: Record<ModelRole, string> = {
  miles: process.env.MILES_OLLAMA_MODEL || 'qwen3:8b',
  agent: process.env.AGENT_OLLAMA_MODEL || 'qwen3:14b' // or 'qwen3:30b-a3b'
}

const OPENROUTER_MODEL = 'google/gemini-3.1-flash-lite:nitro'

// MILES_PROVIDER=openrouter flips everything back to the hosted model.
function buildConfig(role: ModelRole): ProviderConfig {
  if (process.env.MILES_PROVIDER === 'openrouter') {
    return {
      model: OPENROUTER_MODEL,
      name: 'openrouter-ig-idk-idc',
      provider: 'openrouter',
      apiKey: process.env.OPENROUTER_API_KEY
    }
  }
  return {
    model: OLLAMA_MODELS[role],
    name: `ollama-${role}`,
    provider: 'ollama',
    baseURL: process.env.OLLAMA_HOST || 'http://localhost:11434'
  }
}

export async function getModel(role: ModelRole = 'miles'): Promise<{
  model: LanguageModel
  modelId: string
  config: ProviderConfig
}> {
  const config = buildConfig(role)
  return {
    model: withoutVision(buildProvider(config)),
    modelId: `${config.name} · ${config.model}`,
    config
  }
}
