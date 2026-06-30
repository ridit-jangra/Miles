import { collectOnce, CORPUS_FILE } from '../../src/core/events/slack-style-collector'

await collectOnce()
console.log('corpus file:', CORPUS_FILE)
