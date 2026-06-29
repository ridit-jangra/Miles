export const DESCRIPTION = "Read or search persistent memory files.";
export const PROMPT = `Recalls information from past sessions: user preferences, project conventions, people, and anything previously saved.

Two ways to use it:
- query: search across ALL memory files at once (contents + filenames) and get back the best matches with snippets. Reach for this whenever you don't know the exact file — e.g. "bluetooth wake word", "what does sir prefer for commits". This is the normal way to recall something.
- name: read one file in full by its exact name, or "list" to see every file. Use after a search narrows it down, or when you already know the file.

If a search returns nothing relevant, tell the user you don't have it stored and ask them to fill you in (then save it).`;
