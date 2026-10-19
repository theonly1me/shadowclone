import { z } from "zod";

export const repositorySchema = z.object({
  id: z.number().int().positive(),
  full_name: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  default_branch: z.string().min(1),
  owner: z.object({ login: z.string(), type: z.enum(["User", "Organization"]).default("User") }),
  permissions: z.object({ admin: z.boolean() }),
});

export type Repository = z.infer<typeof repositorySchema>;

export const accountLoginPattern = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

export const providers = ["anthropic", "openai", "openai-compatible", "cursor"] as const;

export type Provider = (typeof providers)[number];

export type Engine = "claude" | "codex" | "cursor";

export const providerSecrets: Readonly<Record<Provider, string>> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  "openai-compatible": "OPENAI_COMPATIBLE_API_KEY",
  cursor: "CURSOR_API_KEY",
};

export function providerEngine(provider: Provider): Engine {
  return provider === "anthropic" ? "claude" : provider === "cursor" ? "cursor" : "codex";
}

const providerFields = {
  provider: z.enum(providers),
  baseUrl: z
    .string()
    .regex(/^https:\/\/[A-Za-z0-9.-]+(?::\d{1,5})?(?:\/[\w.~/-]*)?$/, "The base URL must be an https URL with no query or credentials.")
    .optional(),
  model: z.string().regex(/^[\w.:/-]+$/, "The model name can use only letters, digits, and . : / - _").optional(),
};

type ProviderSettings = {
  readonly provider: Provider;
  readonly baseUrl?: string | undefined;
  readonly model?: string | undefined;
};

function checkProviderSettings(settings: ProviderSettings, context: z.RefinementCtx): void {
  if ((settings.provider === "openai-compatible") !== (settings.baseUrl !== undefined)) {
    context.addIssue({
      code: "custom",
      path: ["baseUrl"],
      message: "An OpenAI-compatible provider needs an https base URL, and other providers take none.",
    });
  }

  if (settings.provider === "openai-compatible" && settings.model === undefined) {
    context.addIssue({ code: "custom", path: ["model"], message: "An OpenAI-compatible provider needs a model name." });
  }
}

export const providerSettingsSchema = z.strictObject(providerFields).superRefine(checkProviderSettings);

export const cloneSchema = z
  .strictObject({
    repositoryId: z.number().int().positive(),
    repository: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
    defaultBranch: z.string().min(1),
    owner: z.string().regex(/^[\w-]+$/),
    botId: z.number().int().positive(),
    botLogin: z.string().regex(accountLoginPattern),
    skillsRepository: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
    reviewerBots: z.array(z.string().regex(/^[\w-]+\[bot\]$/)),
    maximumRuns: z.number().int().min(1).max(100).default(10),
    ...providerFields,
    reviewNetwork: z.boolean().default(true),
  })
  .superRefine(checkProviderSettings);

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
  readonly fingerprint: string;
  readonly native: string;
  readonly files: readonly {
    readonly path: string;
    readonly content: string;
    readonly mode: number;
  }[];
  readonly skills: readonly string[];
};
