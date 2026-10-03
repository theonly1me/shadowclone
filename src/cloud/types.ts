import { z } from "zod";

export const repositorySchema = z.object({
  id: z.number().int().positive(),
  full_name: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  default_branch: z.string().min(1),
  owner: z.object({ login: z.string(), type: z.enum(["User", "Organization"]).default("User") }),
  permissions: z.object({ admin: z.boolean() }),
});

export type Repository = z.infer<typeof repositorySchema>;

export const cloneSchema = z.strictObject({
  repositoryId: z.number().int().positive(),
  repository: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  defaultBranch: z.string().min(1),
  owner: z.string().regex(/^[\w-]+$/),
  appId: z.number().int().positive(),
  botId: z.number().int().positive(),
  botLogin: z.string().regex(/^[\w-]+\[bot\]$/),
  requesters: z.array(z.string().regex(/^[\w-]+$/)).min(1),
  reviewerBots: z.array(z.string().regex(/^[\w-]+\[bot\]$/)),
  maximumRuns: z.number().int().min(1).max(100).default(10),
});

export type Clone = z.infer<typeof cloneSchema>;

export type GithubRequest = (
  route: string,
  parameters?: Record<string, unknown>,
) => Promise<{ data: unknown }>;

export type EventContext = {
  readonly eventName: string;
  readonly actor: string;
  readonly runId: number;
  readonly repo: { readonly owner: string; readonly repo: string };
  readonly payload: Record<string, unknown>;
};

export type Delivery = {
  readonly encoded: string;
  readonly fingerprint: string;
  readonly native: string;
  readonly files: readonly {
    readonly path: string;
    readonly content: string;
    readonly mode: number;
  }[];
  readonly skills: readonly string[];
};
