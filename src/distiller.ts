import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

export const SkillSchema = z.object({
  hasNewSkill: z.boolean().describe("True if you identified a clear, reusable engineering pattern or workflow. False if this is just random noise/commands."),
  skillName: z.string().describe("A short, descriptive filename for this skill, e.g. 'bun-setup-workflow'. If no skill is found, return an empty string."),
  description: z.string().describe("A summary of problem-solving engineering workflow observed. If no skill is found, return an empty string."),
  rules: z.array(z.string()).describe("A list of markdown-formatted rules or steps that capture this practice. If no skill is found, return an empty array."),
});

export async function distillHistory(shellHistory: string) {
  console.log("🧠 Distilling history...");

  const { output } = await generateText({
    model: openai("gpt-5-nano"),
    system: `You are an expert engineering observer for the Shadowclone project.
    Your goal is to watch a user's raw terminal history and extract reusable engineering practices,
    debugging workflows, or architectural habits.

    If the history just shows random commands like cd, ls, or basic git commands, set hasNewSkill to false.
    If you see a clear pattern, e.g., resolving a specific type of error, setting up a specific framework,
    or a specific sequence of deployment commands, extract it into a new skill.`,
    prompt: `Here is the user's recent shell history:\n\n${shellHistory}`,
    output: Output.object({
      schema: SkillSchema,
    }),
  });

  return output;
}
