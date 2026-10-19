import { z } from "zod";
import { cloneProviders } from "@shadowclone/clones";

export const cloneSetupTools = [
  {
    name: "shadowclone_clone_setup",
    description:
      "Set up shadowclone clones on this machine. A clone runs Claude Code or Codex as the owner, " +
      "on the owner's subscription or key, in Docker on this machine. Operations: skills pushes the " +
      "owner's skills (show the file list and call again with approve true only after the owner " +
      "agrees). setup adds the default branch ruleset (show its summary and call again with approve " +
      "true only after the owner agrees) and installs shadowclone serve as a service. Tokens never " +
      "pass through this tool: the owner pastes them into the secrets file that setup names. status " +
      "checks the tokens and the model login in a container.",
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: ["skills", "setup", "status"] },
        repository: { type: "string", description: "owner/repository" },
        provider: {
          type: "string",
          enum: [...cloneProviders],
          description: "model login; defaults to claude-subscription",
        },
        baseUrl: {
          type: "string",
          description: "base URL for openai-compatible, ollama, or foundry",
        },
        model: {
          type: "string",
          description: "model id; required for openai-compatible, ollama, and foundry",
        },
        attribution: { type: "boolean", description: "false turns off the Co-authored-by trailer" },
        approve: {
          type: "boolean",
          description: "true only after the owner approved the listed files or the ruleset",
        },
      },
      required: ["operation"],
      additionalProperties: false,
    },
  },
];

export const cloneSetupInputSchema = z.strictObject({
  operation: z.enum(["skills", "setup", "status"]),
  repository: z
    .string()
    .regex(/^[\w.-]+\/[\w.-]+$/)
    .optional(),
  provider: z.enum(cloneProviders).default("claude-subscription"),
  baseUrl: z
    .string()
    .regex(/^https?:\/\//)
    .optional(),
  model: z
    .string()
    .regex(/^[\w.:/-]+$/)
    .optional(),
  attribution: z.boolean().default(true),
  approve: z.boolean().default(false),
});
