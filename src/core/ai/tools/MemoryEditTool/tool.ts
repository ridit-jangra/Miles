import { tool } from "ai";
import { z } from "zod";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { MEMORY_DIR } from "../../utils/env";
import { DESCRIPTION, PROMPT } from "./prompt";

export const MemoryEditTool = tool({
  title: "MemoryEdit",
  description: DESCRIPTION + "\n\n" + PROMPT,
  inputSchema: z.object({
    name: z.string().describe("Name of the memory file."),
    old_string: z.string().describe("The string to replace"),
    new_string: z.string().describe("The replacement string"),
  }),
  execute: async ({ name, old_string, new_string }) => {
    try {
      const fullPath = join(MEMORY_DIR, name);
      if (!fullPath.startsWith(MEMORY_DIR)) {
        return { success: false, error: "Invalid memory file path" };
      }
      if (!existsSync(fullPath)) {
        return { success: false, error: "Memory file does not exist" };
      }
      const content = readFileSync(fullPath, "utf-8");
      if (!content.includes(old_string)) {
        return { success: false, error: "old_string not found in memory file" };
      }
      const updated = content.replace(old_string, new_string);
      writeFileSync(fullPath, updated, "utf-8");
      return { success: true, message: "Memory updated" };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },
});
