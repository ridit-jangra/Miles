import { generateText } from 'ai'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { getModel } from './model'
import { CORPUS_FILE, STYLE_DIR } from '../../events/slack-style-collector'

export const SLACK_STYLE_FILE = join(STYLE_DIR, 'slack-style.md')

type SentMessage = {
  ts: string
  text: string
  channelName?: string
  isIm?: boolean
}

function clean(raw: string): string {
  return raw
    .replace(/<@[^>]+>/g, '') // user mentions
    .replace(/<#[^>]+>/g, '') // channel refs
    .replace(/<(https?:[^>|]+)(\|[^>]+)?>/g, '$1') // links -> bare url
    .replace(/\s+/g, ' ')
    .trim()
}

function isNoise(text: string): boolean {
  if (text.length < 3) return true
  // no real word once emoji shortcodes are removed (kills "77777", ":hii:", symbol spam)
  if (!/[a-z]{2,}/i.test(text.replace(/:[a-z0-9_+-]+:/gi, ''))) return true
  return false
}

export function collectSlackSamples(maxMessages = 400): { sample: string; total: number } {
  if (!existsSync(CORPUS_FILE)) return { sample: '', total: 0 }

  const msgs: SentMessage[] = []
  for (const line of readFileSync(CORPUS_FILE, 'utf-8').split('\n')) {
    if (!line.trim()) continue
    try {
      const m = JSON.parse(line) as SentMessage
      if (m.text) msgs.push(m)
    } catch {
      // skip malformed line
    }
  }
  if (!msgs.length) return { sample: '', total: 0 }

  msgs.sort((a, b) => Number(b.ts) - Number(a.ts))

  const seen = new Set<string>()
  const lines: string[] = []
  for (const m of msgs) {
    if (lines.length >= maxMessages) break
    const text = clean(m.text)
    if (isNoise(text)) continue
    const key = text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const where = m.isIm ? 'DM' : m.channelName ? `#${m.channelName}` : 'channel'
    lines.push(`[${where}] ${text}`)
  }

  return { sample: lines.join('\n'), total: msgs.length }
}

const ANALYSIS_PROMPT = `You are building a precise style guide of how "sir" writes messages on Slack, by studying a sample of messages he actually sent. The goal is for an agent to later draft Slack messages that are indistinguishable from sir's own writing.

Below is the EXISTING style guide (may be empty) followed by NEW message samples (each tagged with where it was sent: a #channel, or DM). Update and refine the guide — keep what still holds, revise what changed, drop what's stale. Be specific and evidence-based; never invent traits not visible in the samples. Write clean markdown with these sections:

# Voice & Tone
Overall vibe — blunt, warm, jokey, terse, formal. How sir comes across.

# Length & Structure
Typical message length, one-liners vs multi-sentence, use of line breaks, lists, threads.

# Punctuation & Capitalization
Does he capitalize sentences? End with periods? Use ellipses, dashes, lowercase everything? Run-ons?

# Emoji & Slang
Which emoji/reactions and slang/abbreviations he actually uses (quote the real ones), and how often.

# Openers & Sign-offs
How he starts and ends messages, greetings, whether he signs off at all.

# Formality by Context
How his style shifts between DMs and channels (or work vs casual).

# Characteristic Phrases
Quote 5-8 short verbatim phrases or constructions that are unmistakably his.

# Drafting Rules
A tight do/don't list an agent should follow to write as sir.

Keep the whole guide under ~700 words. Output ONLY the markdown guide, nothing else.`

const SAMPLE_PROMPT = `You are imitating "sir" writing on Slack. Below is his style guide followed by real messages he sent. Generate brand-new sample messages that are indistinguishable from his own — same voice, slang, misspellings, punctuation habits, emoji use, and attitude.

Cover a realistic spread of situations: casual channel banter, answering a tech question, asking someone about their stack/setup, reacting to news, lightly trolling a friend, expressing frustration at a bug, hyping his own project, a short DM. Vary the length like he does (mostly short, some one-word, occasionally a multi-line stair-step rendered with " / " between lines).

Keep his VOICE — slang, misspellings, lowercase, brevity, emoji — but NOT genuine hostility. He banters, he's not cruel to the person he's talking to: no personal attacks, putdowns, telling people off, or "you're annoying / nobody asked / stop larping" energy aimed at someone. Playful and a little cheeky at most; friendly by default.

Rules:
- Output EXACTLY one message per line, nothing else — no numbering, no bullets, no quotes, no labels.
- Do NOT copy the real examples; write new ones.
- Don't use real @mentions; if you need to address someone write "gng" or a name.
- Get the date right: it is currently {{DATE}} — never reference an older year or call current tools "old" as if it were an earlier year.`

export async function generateSampleMessages(count = 75): Promise<string[]> {
  const guide = existsSync(SLACK_STYLE_FILE) ? readFileSync(SLACK_STYLE_FILE, 'utf-8').trim() : ''
  if (!guide) return []

  const { sample } = collectSlackSamples(60)

  const today = new Date().toISOString().slice(0, 10)

  const { model } = await getModel()
  const { text } = await generateText({
    model,
    system: SAMPLE_PROMPT.replace('{{DATE}}', today),
    prompt: `## STYLE GUIDE\n${guide}\n\n## REAL EXAMPLES (for grounding — do not copy)\n${sample}\n\n## TASK\nWrite ${count} new sample messages, one per line.`
  })

  return text
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').trim())
    .filter((l) => l.length > 0)
    .slice(0, count)
}

export async function analyzeSlackStyle(
  maxMessages = 400
): Promise<{ guide: string; total: number }> {
  const { sample, total } = collectSlackSamples(maxMessages)
  if (!sample) return { guide: '', total: 0 }

  const existing = existsSync(SLACK_STYLE_FILE)
    ? readFileSync(SLACK_STYLE_FILE, 'utf-8').trim()
    : ''

  const { model } = await getModel()
  const { text } = await generateText({
    model,
    system: ANALYSIS_PROMPT,
    prompt: `## EXISTING STYLE GUIDE\n${existing || '(none yet)'}\n\n## NEW MESSAGE SAMPLES (${total} total collected)\n${sample}`
  })

  const guide = text.trim()
  if (guide) writeFileSync(SLACK_STYLE_FILE, guide, 'utf-8')
  return { guide, total }
}
