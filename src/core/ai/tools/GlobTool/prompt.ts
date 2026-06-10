export const DESCRIPTION =
  "Find files by name or path pattern using glob syntax.";
export const PROMPT = `Use this to find files by their name or path — not their contents.

Examples:
- "**/*.ts" — all TypeScript files
- "src/**/tool.ts" — all tool.ts files under src
- "**/*.test.js" — all test files

Use GrepTool instead if you need to search file contents.
Automatically excludes: node_modules, .git, dist, build.`;
