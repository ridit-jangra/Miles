import { tool } from "ai";
import { z } from "zod";
import { glob } from "glob";
import { DESCRIPTION, PROMPT } from "./prompt";
import { cwd } from "process";

export const GlobTool = tool({
  title: "Glob",
  description: DESCRIPTION + "\n\n" + PROMPT,
  inputSchema: z.object({
    pattern: z.string().describe("Glob pattern e.g. **/*.ts or src/**/tool.ts"),
    path: z
      .string()
      .optional()
      .describe("Directory to search in. Defaults to cwd."),
  }),
  execute: async ({ pattern, path }) => {
    try {
      const files = await glob(pattern, {
        cwd: path ?? cwd(),
        absolute: true,
        ignore: [
          "**/node_modules/**",
          "**/.git/**",
          "**/dist/**",
          "**/build/**",
        ],
      });
      return { success: true, files, numFiles: files.length };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },
});
