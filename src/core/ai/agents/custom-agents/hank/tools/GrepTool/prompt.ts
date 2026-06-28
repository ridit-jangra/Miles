export const DESCRIPTION = 'Search file contents for a regex pattern.'

export const PROMPT = `Recursively searches files under a path for lines matching a JavaScript regex, returning file:line matches. Optionally limit to files ending in a suffix via 'glob' (e.g. ".ts"). Skips node_modules/.git/binaries and caps results. Use FileRead to see full context around a match.`
