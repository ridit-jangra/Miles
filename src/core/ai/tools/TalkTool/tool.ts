import { tool } from "ai";
import { z } from "zod";
import { DESCRIPTION } from "./prompt";
import { agentsMap } from "../../agents/customAgent";

export const TalkTool = tool({
  title: "Talk",
  description: DESCRIPTION,
  inputSchema: z.object({
    name: z.string().describe("Name of the agent to send message to"),
    message: z.string().describe("The message you want to send"),
  }),
  execute: async ({ name, message }) => {
    const agent = agentsMap.get(name);
    if (!agent) return { error: `Agent ${name} not found` };

    const response = await agent.chat(message);
    return { success: true, response: response.text };
  },
});
