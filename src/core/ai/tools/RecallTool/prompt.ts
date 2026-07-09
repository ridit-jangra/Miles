export const DESCRIPTION = 'Search everything sir has ever said to you across all past conversations.'

export const PROMPT = `Your searchable long-term conversation history. Use it when sir refers back to something from a previous talk — "what did I say about X", "didn't we discuss Y", "remind me what I decided on Z" — or when you need to recall an earlier exchange that isn't in the current session.

- Pass a 'query' of keywords or a short phrase. It searches the actual words spoken in every past session (both sir's messages and yours) and returns the best-matching moments with roughly when they happened.
- This is raw conversation recall — distinct from MemoryReadTool (curated durable facts). Reach for RecallTool to find what was actually said; MemoryReadTool for facts you deliberately saved.
- If nothing relevant comes back, say you don't have a record of it rather than inventing one. Relay findings naturally in one or two spoken sentences — never read out timestamps or raw excerpts verbatim.`
