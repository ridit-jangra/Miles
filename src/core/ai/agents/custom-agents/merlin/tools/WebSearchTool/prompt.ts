export const DESCRIPTION = 'Search the web via a self-hosted SearXNG instance (no paid API).'

export const PROMPT = `Runs a query against a local SearXNG meta-search instance and returns ranked results (title, url, snippet) aggregated from many engines.

Use this to find sources for a question. Then use WebFetchTool on the most relevant URLs to read the actual page content before answering — snippets alone are not enough for an accurate answer. Prefer reading 2-3 sources and cite the URLs.

Requires SearXNG running locally (default http://localhost:8080) with JSON output enabled. If it returns a connection error, tell sir SearXNG isn't running.`
