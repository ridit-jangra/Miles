import { tool } from "ai";
import { z } from "zod";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { MEMORY_DIR } from "../../utils/env";
import { DESCRIPTION, PROMPT } from "./prompt";

type MemoryHit = {
  file: string;
  score: number;
  snippet: string;
};

function listMemoryFiles(): string[] {
  if (!existsSync(MEMORY_DIR)) return [];
  return readdirSync(MEMORY_DIR).filter(
    (f) => f.endsWith(".md") || f.endsWith(".mdc"),
  );
}

function searchMemory(query: string, limit = 5): MemoryHit[] {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
  if (terms.length === 0) return [];

  const hits: MemoryHit[] = [];

  for (const file of listMemoryFiles()) {
    let content: string;
    try {
      content = readFileSync(join(MEMORY_DIR, file), "utf-8");
    } catch {
      continue;
    }

    const haystack = content.toLowerCase();
    const nameHay = file.toLowerCase();
    const lines = content.split("\n");

    let score = 0;
    const matchedTerms = new Set<string>();

    for (const term of terms) {
      if (nameHay.includes(term)) {
        score += 6;
        matchedTerms.add(term);
      }
      let idx = haystack.indexOf(term);
      let count = 0;
      while (idx !== -1) {
        count++;
        idx = haystack.indexOf(term, idx + term.length);
      }
      if (count > 0) {
        score += count;
        matchedTerms.add(term);
      }
    }

    if (score === 0) continue;

    score += matchedTerms.size * 3;

    const snippetLines: string[] = [];
    for (const line of lines) {
      const ll = line.toLowerCase();
      if (terms.some((t) => ll.includes(t))) {
        const trimmed = line.trim();
        if (trimmed) snippetLines.push(trimmed);
      }
      if (snippetLines.length >= 4) break;
    }

    hits.push({
      file,
      score,
      snippet: snippetLines.join(" … ").slice(0, 400),
    });
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

export const MemoryReadTool = tool({
  title: "MemoryRead",
  description: DESCRIPTION + "\n\n" + PROMPT,
  inputSchema: z.object({
    query: z
      .string()
      .optional()
      .describe(
        "Keywords or a phrase to search across every memory file (contents + filenames). Use this when you don't know the exact filename — returns the best-matching files with snippets.",
      ),
    name: z
      .string()
      .optional()
      .describe(
        'Exact memory file name to read in full (e.g. "user.md"), or "list" to see all available files. Use when you already know the file or after a search points to one.',
      ),
  }),
  execute: async ({ query, name }) => {
    try {
      if (!existsSync(MEMORY_DIR)) {
        return { success: true, content: "", message: "No memory files found" };
      }

      if (query && query.trim()) {
        const results = searchMemory(query);
        if (results.length === 0) {
          return {
            success: true,
            results: [],
            files: listMemoryFiles(),
            message: `No memory matched "${query}". Listing all files instead.`,
          };
        }
        return { success: true, query, results };
      }

      if (!name || name === "list") {
        return { success: true, files: listMemoryFiles() };
      }

      const fullPath = join(MEMORY_DIR, name);
      if (!fullPath.startsWith(MEMORY_DIR)) {
        return { success: false, error: "Invalid memory file path" };
      }

      if (!existsSync(fullPath)) {
        const fallback = searchMemory(name);
        return {
          success: false,
          message: `Memory file "${name}" not found`,
          suggestions: fallback.map((h) => h.file),
        };
      }

      const content = readFileSync(fullPath, "utf-8");
      return { success: true, content };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },
});
