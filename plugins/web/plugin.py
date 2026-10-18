import asyncio
import html
import ipaddress
import re
import socket
from urllib.parse import urljoin, urlparse

import httpx
from ddgs import DDGS

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; Miles/1.0)"}


def html_to_text(raw: str) -> str:
    raw = re.sub(r"<(script|style|noscript)[\s\S]*?</\1>", " ", raw, flags=re.I)
    raw = re.sub(r"<!--[\s\S]*?-->", " ", raw)
    raw = re.sub(r"</(p|div|h[1-6]|li|br|tr|section|article)>", "\n", raw, flags=re.I)
    text = html.unescape(re.sub(r"<[^>]+>", " ", raw))
    text = re.sub(r"[ \t]+", " ", text)
    return re.sub(r"\n\s*\n\s*\n+", "\n\n", text).strip()


def is_public(host: str) -> bool:
    """False for localhost, private networks and anything that doesn't resolve."""
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return False
    return all(ipaddress.ip_address(i[4][0]).is_global for i in infos)


def register(api):
    searxng = str(api.config.get("searxng_url", "")).rstrip("/")

    async def search_searxng(query: str, count: int) -> list[dict]:
        async with httpx.AsyncClient(timeout=15, headers=HEADERS) as client:
            r = await client.get(f"{searxng}/search", params={"q": query, "format": "json"})
            r.raise_for_status()
        return [
            {"title": x["title"], "url": x["url"], "snippet": x.get("content", "")}
            for x in r.json().get("results", [])[:count]
        ]

    def search_ddg(query: str, count: int) -> list[dict]:
        found = DDGS().text(query, max_results=count)
        return [{"title": x["title"], "url": x["href"], "snippet": x["body"]} for x in found]

    @api.tool
    async def web_search(query: str, count: int = 5) -> dict:
        """Search the web for current information. Returns titles, urls and snippets.

        Args:
            query: What to search for.
            count: Max number of results.
        """
        try:
            if searxng:
                results = await search_searxng(query, count)
            else:
                results = await asyncio.to_thread(search_ddg, query, count)
        except Exception as e:
            return {"error": f"Search failed: {e}"}
        return {"query": query, "results": results}

    @api.tool
    async def web_fetch(url: str, max_chars: int = 6000) -> dict:
        """Download a web page and return its readable text. Use after web_search to read a source.

        Args:
            url: The page to read.
            max_chars: Max characters of text to return.
        """
        async with httpx.AsyncClient(timeout=20, headers=HEADERS) as client:
            for _ in range(4):  # follow redirects by hand so every hop is checked
                parsed = urlparse(url)
                host = parsed.hostname or ""
                if parsed.scheme not in ("http", "https") or not await asyncio.to_thread(is_public, host):
                    return {"error": "Blocked: only public http(s) pages can be fetched."}
                try:
                    r = await client.get(url)
                except httpx.HTTPError as e:
                    return {"url": url, "error": str(e)}
                if r.is_redirect:
                    url = urljoin(url, r.headers.get("location", ""))
                    continue
                break
            else:
                return {"url": url, "error": "Too many redirects"}
        if r.status_code >= 400:
            return {"url": url, "error": f"HTTP {r.status_code}"}
        return {"url": url, "text": html_to_text(r.text)[:max_chars]}
