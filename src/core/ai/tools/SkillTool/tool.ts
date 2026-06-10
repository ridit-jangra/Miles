import { tool } from "ai";
import { z } from "zod";
import { skillsMap } from "../../skills/map";
import { PROMPT, DESCRIPTION } from "./prompt.js";

export const SkillTool = tool({
  description: DESCRIPTION + "\n\n" + PROMPT,
  title: "GetSkill",
  inputSchema: z.object({
    name: z
      .string()
      .describe(
        "The exact name of the skill to retrieve (e.g. 'frontend-design')",
      ),
  }),
  execute: async ({ name }) => {
    const skill = skillsMap[name];

    if (!skill) {
      const available = Object.keys(skillsMap);
      return {
        success: false,
        error: `Skill "${name}" not found.`,
        available,
      };
    }

    return {
      success: true,
      name,
      content: skill.content,
    };
  },
});
