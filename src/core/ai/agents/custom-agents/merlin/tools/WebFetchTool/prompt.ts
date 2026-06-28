export const DESCRIPTION = 'Fetch a web page and extract its readable text.'

export const PROMPT = `Downloads a URL and strips it to plain readable text (no nav, scripts, or styling). Use after WebSearchTool to actually read a source before answering.

Limits: static HTML only — it can't run JavaScript, so heavily client-rendered or paywalled pages may return little. It won't bypass logins or CAPTCHAs. Quote and cite what you read; don't invent details that aren't in the returned text.`
