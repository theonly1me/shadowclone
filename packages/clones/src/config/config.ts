import product from "@shadowclone/core/product.json";
import { z } from "zod";
import { providerLogins, cloneProviders, type CloneEngine } from "./providers";

const repositoryNamePattern = /^[\w.-]+\/[\w.-]+$/;
const loginPattern = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const httpsEndpointPattern = /^https:\/\/[A-Za-z0-9.-]+(?::\d{1,5})?(?:\/[\w.~/-]*)?$/;
const httpEndpointPattern = /^https?:\/\/[A-Za-z0-9.-]+(?::\d{1,5})?(?:\/[\w.~/-]*)?$/;
const foundryEndpointPattern =
  /^https:\/\/[A-Za-z0-9-]+\.(?:openai\.azure\.com|services\.ai\.azure\.com|cognitiveservices\.azure\.com)\/openai\/v1\/?$/;

export const defaultCloneImage = `ghcr.io/theonly1me/shadowclone-clone:${product.version}`;

export const cloneConfigVersion = 2;

export const publicChatgptRefusal =
  "OpenAI says not to use a ChatGPT plan login for automation on a public repository. Use an OpenAI API key, an OpenAI-compatible endpoint, Ollama, or Foundry for this repository.";

const endpointRules = {
  https: {
    pattern: httpsEndpointPattern,
    message: "needs an https base URL with no query or credentials",
  },
  "http-or-https": {
    pattern: httpEndpointPattern,
    message: "needs an http or https base URL with no query or credentials",
  },
  foundry: {
    pattern: foundryEndpointPattern,
    message: "needs a base URL such as https://<resource>.openai.azure.com/openai/v1",
  },
} as const;

export const cloneConfigSchema = z
  .strictObject({
    version: z.literal(cloneConfigVersion),
    repository: z.string().regex(repositoryNamePattern),
    repositoryId: z.number().int().positive(),
    defaultBranch: z.string().min(1),
    visibility: z.enum(["public", "private", "internal"]),
    ownerId: z.number().int().positive(),
    ownerLogin: z.string().regex(loginPattern),
    skillsRepository: z.string().regex(repositoryNamePattern),
    provider: z.enum(cloneProviders),
    baseUrl: z.string().optional(),
    model: z
      .string()
      .regex(/^[\w.:/-]+$/, "The model name can use only letters, digits, and . : / - _")
      .optional(),
    image: z
      .string()
      .regex(/^[\w.-]+(?::\d+)?(?:\/[\w.-]+)*(?::[\w.-]+)?(?:@sha256:[a-f0-9]{64})?$/)
      .default(defaultCloneImage),
    attribution: z.boolean().default(true),
    dailyClones: z.number().int().min(1).max(100).default(20),
  })
  .superRefine((config, context) => {
    const login = providerLogins[config.provider];

    if (login.endpoint === "none" && config.baseUrl !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["baseUrl"],
        message: `The ${config.provider} provider takes no base URL.`,
      });
    }

    if (login.endpoint !== "none") {
      const rule = endpointRules[login.endpoint];

      if (config.baseUrl === undefined || !rule.pattern.test(config.baseUrl)) {
        context.addIssue({
          code: "custom",
          path: ["baseUrl"],
          message: `The ${config.provider} provider ${rule.message}.`,
        });
      }
    }

    if (login.modelRequired && config.model === undefined) {
      context.addIssue({
        code: "custom",
        path: ["model"],
        message: `The ${config.provider} provider needs a model name.`,
      });
    }

    if (config.provider === "chatgpt-subscription" && config.visibility === "public") {
      context.addIssue({ code: "custom", path: ["provider"], message: publicChatgptRefusal });
    }
  });

export type CloneConfig = z.infer<typeof cloneConfigSchema>;

export type CloneConfigInput = z.input<typeof cloneConfigSchema>;

export function cloneEngine(config: Pick<CloneConfig, "provider">): CloneEngine {
  return providerLogins[config.provider].engine;
}
