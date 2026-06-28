/* eslint-disable @typescript-eslint/no-explicit-any */
import { tool } from 'ai'
import { z } from 'zod'
import { readFileSync, existsSync } from 'fs'
import { CONFIG_FILE } from '../../../../../utils/env'
import { DESCRIPTION, PROMPT } from './prompt'

function searxngBase(): string {
  if (process.env.SEARXNG_URL) return process.env.SEARXNG_URL
  if (existsSync(CONFIG_FILE)) {
    try {
      const cfg = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'))
      if (cfg.SEARXNG_URL) return cfg.SEARXNG_URL
    } catch {
      // ignore
    }
  }
  return 'http://localhost:8080'
}

export const WebSearchTool = tool({
  title: 'WebSearch',
  description: DESCRIPTION + '\n\n' + PROMPT,
  inputSchema: z.object({
    query: z.string().describe('The search query'),
    count: z.number().optional().describe('Max results to return (default 8)')
  }),
  execute: async ({ query, count }) => {
    const base = searxngBase()
    try {
      const url = new URL('/search', base)
      url.searchParams.set('q', query)
      url.searchParams.set('format', 'json')
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; Milo/1.0)' },
        signal: AbortSignal.timeout(15000)
      })
      if (!res.ok) {
        return {
          success: false,
          error: `SearXNG returned ${res.status}. Make sure it's running at ${base} with JSON format enabled in settings.yml.`
        }
      }
      const data: any = await res.json()
      const results = (data.results ?? []).slice(0, count ?? 8).map((r: any) => ({
        title: r.title,
        url: r.url,
        snippet: r.content
      }))
      return { success: true, query, results }
    } catch (err) {
      return {
        success: false,
        error: `Could not reach SearXNG at ${base} (${String(err)}). Is the container running?`
      }
    }
  }
})
