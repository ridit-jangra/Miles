export function safeParseJSON(json: string | null | undefined): unknown {
  if (!json) return null

  // strip markdown fences
  const cleaned = json.replace(/```json\n?|\n?```/g, '').trim()

  try {
    return JSON.parse(cleaned)
  } catch {
    try {
      const repaired = repairJSON(cleaned)
      if (repaired) return JSON.parse(repaired)
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/)
      if (match) {
        try {
          return JSON.parse(match[0])
        } catch {
          return null
        }
      }
    }
    return null
  }
}

export function repairJSON(raw: string): string | null {
  try {
    JSON.parse(raw)
    return raw
  } catch {
    const repaired = raw.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
    try {
      JSON.parse(repaired)
      return repaired
    } catch {
      return null
    }
  }
}
