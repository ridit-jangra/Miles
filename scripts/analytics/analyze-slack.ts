import { analyzeSlackStyle, SLACK_STYLE_FILE } from '../../src/core/ai/utils/analyzeSlackStyle'

const { guide, total } = await analyzeSlackStyle(500)
console.log(`corpus total: ${total}`)
console.log(`written to: ${SLACK_STYLE_FILE}\n`)
console.log(guide)
