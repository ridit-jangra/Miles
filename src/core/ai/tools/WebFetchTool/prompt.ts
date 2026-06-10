export const DESCRIPTION = "Fetch the content of a URL and return its text.";
export const PROMPT = `Fetches a webpage and returns its text content with HTML stripped.

Guidelines:
- Use this to read documentation, articles, or any webpage
- Content is truncated to 8000 characters
- Always provide a full URL including https://

# Undraw illustrations
The undraw search page is client-side rendered — always use the API.

Fetching an undraw illustration:
1. WebFetchTool → https://undraw.co/api/search?q=<term>
2. Grab the "media" URL directly from the result (e.g. https://cdn.undraw.co/illustrations/cat_lqdj.svg)
3. DownloadTool with that media URL → save as <slug>.svg

Never fetch the illustration page. The media URL from the API response is the direct SVG download link.`;
