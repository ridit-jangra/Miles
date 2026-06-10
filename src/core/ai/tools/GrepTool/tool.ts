import { tool } from "ai";
import { z } from "zod";
import { grep } from "../../utils/ripgrep";
import { DESCRIPTION, PROMPT } from "./prompt";
import { resolve } from "path";
import { cwd } from "process";

export const GrepTool = tool({
  description: DESCRIPTION + "\n\n" + PROMPT,
  title: "Grep",
  inputSchema: z.object({
    pattern: z
      .string()
      .describe("Regex or string pattern to search for in file contents"),
    path: z
      .string()
      .optional()
      .describe(
        "Absolute path to file or directory to search. Defaults to current working directory if omitted.",
      ),
    caseInsensitive: z.boolean().default(false).describe("Ignore case"),
    include: z
      .string()
      .optional()
      .describe("File glob pattern e.g. *.ts or *.{ts,tsx}"),
  }),
  execute: async ({ pattern, path, caseInsensitive, include }) => {
    try {
      const resolvedPath = path ? resolve(path) : cwd();
      const matches = await grep(pattern, resolvedPath, {
        caseInsensitive,
        include,
      });
      if (matches.length === 0)
        return { success: true, matches: [], message: "No matches found" };
      return { success: true, matches };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },
});
