import { tool } from "ai";
import { z } from "zod";
import { DESCRIPTION, PROMPT } from "./prompt";

export const ThinkTool = tool({
  title: "Think",
  description: DESCRIPTION + "\n\n" + PROMPT,
  inputSchema: z.object({
    thought: z
      .string()
      .describe("Your reasoning, plan, or analysis before taking action"),
  }),
  execute: async ({ thought }) => {
    return { success: true, thought };
  },
});
