import { tool } from "ai";
import { z } from "zod";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import { MEMORY_DIR } from "../../utils/env";
import { DESCRIPTION, PROMPT } from "./prompt";

export const MemoryReadTool = tool({
  title: "MemoryRead",
  description: DESCRIPTION + "\n\n" + PROMPT,
  inputSchema: z.object({
    name: z
      .string()
      .describe(
        'Memory file name to read (e.g. "user.md", "meridia.md"), or "list" to see all available files',
      ),
  }),
  execute: async ({ name }) => {
    try {
      if (!existsSync(MEMORY_DIR)) {
        return { success: true, content: "", message: "No memory files found" };
      }

      if (name === "list") {
        const files = readdirSync(MEMORY_DIR).filter(
          (f) => f.endsWith(".md") || f.endsWith(".mdc"),
        );
        return { success: true, files };
      }

      const fullPath = join(MEMORY_DIR, name);
      if (!fullPath.startsWith(MEMORY_DIR)) {
        return { success: false, error: "Invalid memory file path" };
      }

      if (!existsSync(fullPath)) {
        return { success: false, message: `Memory file "${name}" not found` };
      }

      const content = readFileSync(fullPath, "utf-8");
      return { success: true, content };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },
});
