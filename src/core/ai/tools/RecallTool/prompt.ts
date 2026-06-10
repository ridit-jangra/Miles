export const DESCRIPTION =
  "Search through past Milo session history to recall previous conversations, code decisions, or context.";

export const PROMPT = `Use this tool when the user references something from a previous session, asks what was discussed before, or needs context from past conversations.

Triggers:
- "remember when we...", "last time we...", "what did we discuss about..."
- User references a past decision, file, or feature without current context
- You need historical context to answer accurately

Returns snippets from past session messages ranked by keyword relevance.

Do NOT use for current session context — that's already in your message history.`;
