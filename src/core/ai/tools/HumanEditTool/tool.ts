import { tool } from "ai";
import { z } from "zod";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import { HUMAN_MEMORY_FILE } from "../../utils/env";
import { DESCRIPTION, PROMPT } from "./prompt";

export const HumanEditTool = tool({
  title: "HumanEdit",
  description: DESCRIPTION + "\n\n" + PROMPT,
  inputSchema: z.object({
    content: z
      .string()
      .describe("The new thing you learned about the human. Concise markdown."),
  }),
  execute: async ({ content }) => {
    try {
      mkdirSync(dirname(HUMAN_MEMORY_FILE), { recursive: true });

      const existing = existsSync(HUMAN_MEMORY_FILE)
        ? readFileSync(HUMAN_MEMORY_FILE, "utf-8")
        : "";

      const updated = existing ? `${existing}\n---\n${content}` : content;

      writeFileSync(HUMAN_MEMORY_FILE, updated, "utf-8");
      return { success: true, message: "Human memory updated" };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  },
});
