import { tool } from "ai";
import { z } from "zod";
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { MEMORY_DIR } from "../../utils/env";
import { DESCRIPTION, PROMPT } from "./prompt";

export const MemoryWriteTool = tool({
  title: "MemoryWrite",
  description: DESCRIPTION + "\n\n" + PROMPT,
  inputSchema: z.object({
    content: z.string().describe("Full content to write to the memory file"),
    name: z
      .string()
      .describe(
        "Memory name that you thinks fits. use casing like this word1-word2-...md",
      ),
  }),
  execute: async ({ name, content }) => {
    try {
      const fullPath = join(MEMORY_DIR, name);
      if (!fullPath.startsWith(MEMORY_DIR)) {
        return { success: false, error: "Invalid memory file path" };
      }
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, content, "utf-8");
      return { success: true, message: "Memory saved" };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },
});
