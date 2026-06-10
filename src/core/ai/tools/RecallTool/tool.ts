import { tool } from "ai";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { DESCRIPTION, PROMPT } from "./prompt";
import { SESSIONS_DIR } from "../../utils/env";

type Message = {
  role: string;
  content: string;
};

type Session = {
  messages: Message[];
  createdAt?: number;
};

function extractText(session: Session): string {
  return session.messages.map((m) => `[${m.role}] ${m.content}`).join("\n");
}

function isVagueQuery(query: string) {
  const vague = [
    "last time",
    "previous",
    "what were we doing",
    "recent",
    "earlier",
    "before",
  ];
  const q = query.toLowerCase();
  return vague.some((v) => q.includes(v));
}

async function getSessionFilesSorted(): Promise<string[]> {
  const files = await fs.readdir(SESSIONS_DIR);

  const fullPaths = files
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(SESSIONS_DIR, f));

  const stats = await Promise.all(
    fullPaths.map(async (file) => ({
      file,
      stat: await fs.stat(file),
    })),
  );

  return stats
    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)
    .map((s) => s.file);
}

async function readSession(file: string): Promise<Session | null> {
  try {
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function scoreMatch(text: string, query: string): number {
  const t = text.toLowerCase();
  const q = query.toLowerCase();

  let score = 0;

  for (const word of q.split(/\s+/)) {
    if (t.includes(word)) score += 1;
  }

  return score;
}

export const RecallTool = tool({
  title: "Recall",
  description: DESCRIPTION + "\n\n" + PROMPT,

  inputSchema: z.object({
    query: z.string().describe("What to recall from past sessions"),
    max_results: z.number().optional().default(5),
  }),

  execute: async ({ query, max_results }) => {
    const files = await getSessionFilesSorted();

    if (isVagueQuery(query)) {
      const recent = [];

      for (const file of files.slice(0, max_results)) {
        const session = await readSession(file);
        if (!session) continue;

        const text = extractText(session);

        recent.push({
          sessionFile: path.basename(file),
          snippet: text.slice(0, 800),
        });
      }

      return {
        query,
        mode: "recent",
        results: recent,
      };
    }

    const results: {
      sessionFile: string;
      snippet: string;
      score: number;
    }[] = [];

    for (const file of files.slice(0, 20)) {
      const session = await readSession(file);
      if (!session) continue;

      const text = extractText(session);
      const score = scoreMatch(text, query);

      if (score > 0) {
        results.push({
          sessionFile: path.basename(file),
          snippet: text.slice(0, 800),
          score,
        });
      }
    }

    if (results.length === 0) {
      return {
        query,
        results: [],
        message:
          "No strong matches found. Try a more specific query or ask for recent sessions.",
      };
    }

    results.sort((a, b) => b.score - a.score);

    return {
      query,
      total_matches: results.length,
      results: results
        .slice(0, max_results)
        .map(({ score: _score, ...rest }) => rest),
    };
  },
});
