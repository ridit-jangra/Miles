export const DESCRIPTION = "Search for a pattern across files in a directory.";

export const PROMPT = `
- Fast content search tool that works with any codebase size
- Searches file contents using regular expressions
- Supports full regex syntax (e.g. "log.*Error", "function\\s+\\w+", etc.)
- Filter files by pattern with the include parameter (e.g. "*.js", "*.{ts,tsx}")
- Returns matching lines with file path and line number
- Results capped at 500 matches
- Automatically excludes: node_modules, .git, dist, build, .next, out, coverage
- Always use this instead of grep, findstr, or any bash search command
- Use this when you need to find files containing specific patterns or usages
`.trim();
