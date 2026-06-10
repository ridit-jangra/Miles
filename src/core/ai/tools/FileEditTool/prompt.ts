export const DESCRIPTION =
  "Edit an existing file by replacing a specific string with new content.";
export const PROMPT = `Edits a file by replacing an exact string match with new content. The path parameter must be an absolute path, not a relative path.

The old_string must match exactly once in the file — if it matches zero or multiple times, the edit will fail. Make old_string specific enough to be unique, including surrounding context if needed.

Guidelines:
- Always read the file before editing so you know the exact content
- Never use this tool on a file you haven't read first
- Prefer small, targeted edits over rewriting large sections
- Preserve the original indentation and formatting
- If you need to make multiple edits, make them one at a time
- When using old_string, copy the exact content WITHOUT the line number prefix (e.g. use "app.listen" not "     9\tapp.listen")`;
