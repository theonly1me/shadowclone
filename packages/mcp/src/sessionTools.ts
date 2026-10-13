import { z } from "zod";
import { sessionHosts, sessionProviders, sessionReceivers } from "@shadowclone/clones";

export const sessionTools = [
  {
    name: "shadowclone_session",
    description:
      "Set up and use shadowclone cloud sessions. A session runs Claude Code or Codex as the owner, " +
      "on the owner's subscription or key, and only the owner's /shadowclone comment starts it. " +
      "host local runs sessions in Docker on this machine. host cloudflare, vercel, or modal deploys " +
      "a receiver and runs sessions in that account. host daytona or e2b also needs receiver " +
      "cloudflare, vercel, supabase, or deno. Operations: skills pushes the owner's skills (show the " +
      "file list and call again with approve true only after the owner agrees). setup adds the " +
      "default branch ruleset (show its summary and call again with approve true only after the " +
      "owner agrees) and deploys the host. Tokens never pass through this tool: the owner adds them " +
      "with shadowclone session secrets, or in the secrets file or host page that setup names. " +
      "status checks the host. start posts /shadowclone with a task on an issue or pull request.",
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: ["skills", "setup", "status", "start"] },
        repository: { type: "string", description: "owner/repository" },
        host: {
          type: "string",
          enum: [...sessionHosts],
          description: "where sessions run; defaults to local",
        },
        receiver: {
          type: "string",
          enum: [...sessionReceivers],
          description: "the account that receives GitHub events, only for host daytona or e2b",
        },
        supabaseProject: {
          type: "string",
          description: "Supabase project ref for receiver supabase",
        },
        denoOrganization: {
          type: "string",
          description: "Deno Deploy organization for receiver deno",
        },
        provider: {
          type: "string",
          enum: [...sessionProviders],
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
        issue: { type: "number", description: "issue or pull request number for start" },
        task: { type: "string", description: "task text for start" },
      },
      required: ["operation"],
      additionalProperties: false,
    },
  },
];

export const sessionInputSchema = z.strictObject({
  operation: z.enum(["skills", "setup", "status", "start"]),
  repository: z
    .string()
    .regex(/^[\w.-]+\/[\w.-]+$/)
    .optional(),
  provider: z.enum(sessionProviders).default("claude-subscription"),
  host: z.enum(sessionHosts).default("local"),
  receiver: z.enum(sessionReceivers).optional(),
  supabaseProject: z
    .string()
    .regex(/^[a-z0-9]{8,40}$/)
    .optional(),
  denoOrganization: z
    .string()
    .regex(/^[\w-]{1,64}$/)
    .optional(),
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
  issue: z.number().int().positive().optional(),
  task: z.string().max(4000).default(""),
});
