import { tool } from "ai";
import { z } from "zod";
import { DESCRIPTION, PROMPT } from "./prompt.js";

export const WebFetchTool = tool({
  description: DESCRIPTION + "\n\n" + PROMPT,
  inputSchema: z.object({
    url: z.string().describe("The URL to fetch"),
  }),
  title: "WebFetch",
  execute: async ({ url }) => {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Milo/1.0)",
        },
        signal: AbortSignal.timeout(10000),
      });
      const html = await res.text();

      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 8000);
      return { success: true, url, content: text };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },
});
