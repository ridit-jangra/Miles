import { generateSampleMessages } from '../../src/core/ai/utils/analyzeSlackStyle'

const count = Number(process.argv[2] ?? 75)
const samples = await generateSampleMessages(count)

console.log(`generated ${samples.length} sample messages:\n`)
samples.forEach((m, i) => console.log(`${String(i + 1).padStart(3)}. ${m}`))
