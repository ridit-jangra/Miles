/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import { createGroq } from '@ai-sdk/groq'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOllama } from 'ai-sdk-ollama'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { wrapLanguageModel, type LanguageModel, type LanguageModelMiddleware } from 'ai'

const IMAGE_NOTE = '[image omitted — the active model cannot read images]'

function isImage(mediaType: unknown): boolean {
  return typeof mediaType === 'string' && mediaType.startsWith('image/')
}

const stripImagesMiddleware: LanguageModelMiddleware = {
  specificationVersion: 'v3',
  transformParams: async ({ params }) => {
    const prompt = (params.prompt as any[]).map((msg) => {
      if (!msg || !Array.isArray(msg.content)) return msg
      const content = msg.content.map((part: any) => {
        if (part?.type === 'file' && isImage(part.mediaType)) {
          return { type: 'text', text: IMAGE_NOTE }
        }
        if (part?.type === 'tool-result' && part.output?.type === 'content' && Array.isArray(part.output.value)) {
          const value = part.output.value.map((item: any) =>
            item?.type === 'media' && isImage(item.mediaType) ? { type: 'text', text: IMAGE_NOTE } : item
          )
          return { ...part, output: { ...part.output, value } }
        }
        return part
      })
      return { ...msg, content }
    })
    return { ...params, prompt }
  }
}

export function withoutVision(model: LanguageModel): LanguageModel {
  return wrapLanguageModel({ model: model as any, middleware: stripImagesMiddleware })
}

export type ProviderType =
  | 'groq'
  | 'openai'
  | 'anthropic'
  | 'ollama'
  | 'openrouter'
  | 'hackclub'
  | 'google'

export type ProviderConfig = {
  name: string
  provider: ProviderType
  model: string
  apiKey?: string
  baseURL?: string
  supportsTools?: boolean
}

export type ProvidersFile = {
  active: string
  providers: ProviderConfig[]
}

const PROVIDERS_FILE = join(homedir(), '.milo', 'providers.json')

const EMPTY_PROVIDERS: ProvidersFile = {
  active: '',
  providers: []
}

export async function readProviders(): Promise<ProvidersFile> {
  try {
    const raw = await readFile(PROVIDERS_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return { ...EMPTY_PROVIDERS }
  }
}

export async function writeProviders(data: ProvidersFile): Promise<void> {
  await mkdir(join(homedir(), '.milo'), { recursive: true })
  await writeFile(PROVIDERS_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

export async function getActiveProvider(): Promise<ProviderConfig | null> {
  const data = await readProviders()
  if (!data.active || data.providers.length === 0) return null
  return data.providers.find((p) => p.name === data.active) ?? null
}

export async function setActiveProvider(name: string): Promise<void> {
  const data = await readProviders()
  if (!data.providers.find((p) => p.name === name)) {
    throw new Error(`Provider "${name}" not found`)
  }
  data.active = name
  await writeProviders(data)
}

export async function addProvider(config: ProviderConfig): Promise<void> {
  const data = await readProviders()
  const exists = data.providers.findIndex((p) => p.name === config.name)
  if (exists >= 0) {
    data.providers[exists] = config
  } else {
    data.providers.push(config)
  }

  if (data.providers.length === 1) {
    data.active = config.name
  }
  await writeProviders(data)
}

export async function removeProvider(name: string): Promise<void> {
  const data = await readProviders()
  data.providers = data.providers.filter((p) => p.name !== name)
  if (data.active === name) {
    data.active = data.providers[0]?.name ?? ''
  }
  await writeProviders(data)
}

export function buildProvider(config: ProviderConfig): LanguageModel {
  switch (config.provider) {
    case 'groq':
      if (!config.apiKey) {
        throw new Error('Groq API key missing. Use `/providers` to set credentials.', {
          cause: 'No apiKey found'
        })
      }
      try {
        return createGroq({ apiKey: config.apiKey })(config.model)
      } catch (error) {
        throw new Error(`Groq connection failed: ${(error as any).message}`, {
          cause: error
        })
      }

    case 'openai':
      if (!config.apiKey) {
        throw new Error('OpenAI API key missing. Use `/providers` to set credentials.', {
          cause: 'No apiKey found'
        })
      }
      try {
        return createOpenAI({
          apiKey: config.apiKey,
          ...(config.baseURL ? { baseURL: config.baseURL } : {})
        })(config.model)
      } catch (error) {
        throw new Error(`OpenAI connection failed: ${(error as any).message}`, {
          cause: error
        })
      }

    case 'anthropic':
      if (!config.apiKey) {
        throw new Error('Anthropic API key missing. Use `/providers` to set credentials.', {
          cause: 'No apiKey found'
        })
      }
      try {
        return createAnthropic({ apiKey: config.apiKey })(config.model)
      } catch (error) {
        throw new Error(`Anthropic connection failed: ${(error as any).message}`, { cause: error })
      }

    case 'ollama':
      try {
        return createOllama({
          baseURL: config.baseURL ?? 'http://localhost:11434'
        })(config.model)
      } catch (error) {
        throw new Error(`Ollama connection failed: ${(error as any).message}`, {
          cause: error
        })
      }

    case 'google':
      if (!config.apiKey) {
        throw new Error('Google Gemini API key missing. Use `/providers` to set credentials.', {
          cause: 'No apiKey found'
        })
      }
      try {
        return createGoogleGenerativeAI({ apiKey: config.apiKey })(config.model)
      } catch (error) {
        throw new Error(`Google Gemini connection failed: ${(error as any).message}`, {
          cause: error
        })
      }
    case 'openrouter':
      if (!config.apiKey) {
        throw new Error('OpenRouter API key missing. Use `/providers` to set credentials.', {
          cause: 'No apikey found'
        })
      }
      try {
        return createOpenRouter({
          apiKey: config.apiKey,
          ...(config.baseURL ? { baseURL: config.baseURL } : {})
        })(config.model)
      } catch (error) {
        throw new Error(
          `OpenRouter connection failed: ${(error as unknown as { message: string }).message}`,
          { cause: error }
        )
      }
    case 'hackclub':
      if (!config.apiKey) {
        throw new Error('OpenRouter API key missing. Use `/providers` to set credentials.', {
          cause: 'No apikey found'
        })
      }
      try {
        return createOpenRouter({
          apiKey: config.apiKey,
          baseURL: 'https://ai.hackclub.com/proxy/v1/chat/completions'
        })(config.model)
      } catch (error) {
        throw new Error(
          `OpenRouter connection failed: ${(error as unknown as { message: string }).message}`,
          { cause: error }
        )
      }
  }
}
