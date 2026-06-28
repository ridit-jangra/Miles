import { tool } from 'ai'
import { z } from 'zod'
import { DESCRIPTION, PROMPT } from './prompt'

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|h[1-6]|li|br|tr|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim()
}

export const WebFetchTool = tool({
  title: 'WebFetch',
  description: DESCRIPTION + '\n\n' + PROMPT,
  inputSchema: z.object({
    url: z.string().describe('The URL to fetch'),
    maxChars: z.number().optional().describe('Max characters of text to return (default 8000)')
  }),
  execute: async ({ url, maxChars }) => {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Milo/1.0)' },
        signal: AbortSignal.timeout(20000)
      })
      if (!res.ok) return { success: false, url, error: `HTTP ${res.status}` }
      const html = await res.text()
      const text = htmlToText(html).slice(0, maxChars ?? 8000)
      return { success: true, url, text }
    } catch (err) {
      return { success: false, url, error: String(err) }
    }
  }
})
