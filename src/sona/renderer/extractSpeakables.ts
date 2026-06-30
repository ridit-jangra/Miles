const MIN_WORDS = 8
const CLAUSE_MIN = 12

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length
}

export function extractSpeakable(
  buf: string,
  minWords = MIN_WORDS,
  clauseMin = CLAUSE_MIN
): [string, string] {
  const sentenceMatch = buf.match(/^([\s\S]*?[.!?])(\s+|$)/)
  if (sentenceMatch) {
    const candidate = sentenceMatch[1].trim()
    if (wordCount(candidate) >= minWords) {
      return [candidate, buf.slice(sentenceMatch[0].length)]
    }

    const rest = buf.slice(sentenceMatch[0].length)
    const nextMatch = rest.match(/^([\s\S]*?[.!?])(\s+|$)/)
    if (nextMatch) {
      const extended = (candidate + ' ' + nextMatch[1]).trim()
      return [extended, rest.slice(nextMatch[0].length)]
    }

    return ['', buf]
  }

  const clauseMatch = buf.match(/^([\s\S]*?[,;:])(\s+)/)
  if (clauseMatch) {
    const candidate = clauseMatch[1].trim()
    if (wordCount(candidate) >= clauseMin) {
      return [candidate, buf.slice(clauseMatch[0].length)]
    }
  }

  return ['', buf]
}
