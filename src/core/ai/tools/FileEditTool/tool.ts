import { tool } from "ai";
import { z } from "zod";
import { readFile, writeFile } from "fs/promises";
import { createPatch } from "diff";
import { DESCRIPTION, PROMPT } from "./prompt.js";
import { requestPermission } from "../../permissions";

export const FileEditTool = tool({
  description: DESCRIPTION + "\n\n" + PROMPT,
  inputSchema: z.object({
    path: z.string().describe("The absolute file path to edit"),
    old_string: z.string().describe("The exact string to replace"),
    new_string: z.string().describe("The string to replace it with"),
  }),
  title: "EditFile",
  execute: async ({ path, old_string, new_string }) => {
    try {
      const content = await readFile(path, "utf-8");
      const normalizedContent = content.replace(/\r\n/g, "\n");
      const normalizedOld = old_string.replace(/\r\n/g, "\n");
      const normalizedNew = new_string.replace(/\r\n/g, "\n");

      const firstIdx = normalizedContent.indexOf(normalizedOld);
      if (firstIdx === -1)
        return { success: false, error: "old_string not found in file" };
      const secondIdx = normalizedContent.indexOf(
        normalizedOld,
        firstIdx + normalizedOld.length,
      );
      if (secondIdx !== -1)
        return { success: false, error: `old_string matches multiple times` };

      const newContent =
        normalizedContent.slice(0, firstIdx) +
        normalizedNew +
        normalizedContent.slice(firstIdx + normalizedOld.length);

      const finalContent = content.includes("\r\n")
        ? newContent.replace(/\n/g, "\r\n")
        : newContent;
      const patch = createPatch(path, content, finalContent);
      const decision = await requestPermission("FileEditTool", { path, patch });
      if (decision === "deny")
        return { success: false, error: "User denied permission" };

      await writeFile(path, newContent, "utf-8");
      return { success: true, path, patch };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },
});
