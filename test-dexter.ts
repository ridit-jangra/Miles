import { chatStream } from './src/core/ai/agents/custom-agents/dexter/agent'

const prompt =
  process.argv.slice(2).join(' ') ||
  'Draft (text only — do NOT send anything, no Slack tools) a casual message for the #lounge channel letting people know my assistant Echo can now reply in my voice. Just give me the draft message itself.'

console.log(`PROMPT: ${prompt}\n\n--- dexter ---`)
const { text } = await chatStream(prompt, (d) => process.stdout.write(d))
console.log('\n\n=== final draft ===\n' + text)
process.exit(0)
