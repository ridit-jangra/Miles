import { mcpManager } from './src/core/mcp/manager'
import { chatStream } from './src/core/ai/agents/custom-agents/dexter/agent'

console.log('connecting MCP...')
await mcpManager.init()
const slack = mcpManager.list().find((s) => s.name.toLowerCase() === 'slack')
console.log('slack status:', slack?.status, '| tools:', slack?.tools?.length ?? 0)
if (slack?.status !== 'connected') {
  console.error('Slack MCP not connected — aborting send.')
  process.exit(1)
}

const msg = 'yo i gave echo some new voice sauce so it sounds like me now pretty trippy tbh :sadsip:'
const prompt = `Sir has ALREADY approved this exact message and wants it posted VERBATIM (no edits, no rephrasing, no extra words) to BOTH the #lounge channel and the #pixl channel. Post it now to both channels using the Slack tools. Do not ask for confirmation again — it is already given. The message is exactly:\n\n${msg}`

console.log('\n--- dexter ---')
const { text } = await chatStream(prompt, (d) => process.stdout.write(d))
console.log('\n\n=== final ===\n' + text)
await mcpManager.shutdown()
process.exit(0)
