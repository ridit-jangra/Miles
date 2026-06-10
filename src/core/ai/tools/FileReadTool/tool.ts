import { readFile } from "fs/promises";
import { tool } from "ai";
import { z } from "zod";
import { resolve } from "path";
import { PROMPT, DESCRIPTION } from "./prompt.js";
import { addLineNumbers, findSimilarFile } from "../../utils/file";

export const FileReadTool = tool({
  description: DESCRIPTION + "\n\n" + PROMPT,
  title: "ReadFile",
  inputSchema: z.object({
    path: z.string().describe("The file path to read"),
    line_start: z
      .number()
      .optional()
      .describe("Line number to start reading from (1-indexed)"),
    line_end: z
      .number()
      .optional()
      .describe("Line number to stop reading at (inclusive)"),
  }),
  execute: async ({ path, line_start, line_end }) => {
    try {
      const absolutePath = resolve(path);
      let lines = (await readFile(absolutePath, "utf-8")).split("\n");
      const totalLines = lines.length;

      const start = line_start ? line_start - 1 : 0;
      const end = line_end ?? lines.length;

      lines = lines.slice(start, end);
      const content = addLineNumbers(lines.join("\n"), start + 1);
      return { success: true, content, totalLines };
    } catch (err) {
      const similar = findSimilarFile(path);
      return {
        success: false,
        error: String(err),
        suggestion: similar ? `Did you mean: ${similar}?` : undefined,
      };
    }
  },
});
