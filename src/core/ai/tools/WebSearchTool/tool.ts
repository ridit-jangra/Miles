import { tool } from "ai";
import { z } from "zod";
import { DESCRIPTION, PROMPT } from "./prompt.js";

export const WebSearchTool = tool({
  description: DESCRIPTION + "\n\n" + PROMPT,
  inputSchema: z.object({
    query: z.string().describe("The search query"),
  }),
  title: "WebSearch",
  execute: async ({ query }) => {
    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Milo/1.0)",
        },
        signal: AbortSignal.timeout(10000),
      });
      const html = await res.text();

      const results: { title: string; url: string; snippet: string }[] = [];
      const resultRegex =
        /<a class="result__a" href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
      let match;
      while ((match = resultRegex.exec(html)) !== null && results.length < 8) {
        results.push({
          url: match[1] ?? "",
          title: match[2]?.trim() ?? "",
          snippet: match[3]?.replace(/<[^>]+>/g, "").trim() ?? "",
        });
      }

      if (results.length === 0) {
        // fallback — just strip html
        const text = html
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 4000);
        return { success: true, query, results: [], raw: text };
      }

      return { success: true, query, results };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },
});
