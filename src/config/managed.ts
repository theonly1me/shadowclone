import { stat } from "node:fs/promises";
import { z } from "zod";
import type { EngineId } from "../engine";
import {
  sourceIds,
  type ShadowcloneConfig,
  type SourceId,
} from "./schema";

export type DistillationPolicy = "allowed" | "local-only" | "disabled";
export type ActionTier = "observe" | "draft" | "act";

export type ManagedPolicy = {
  readonly enabled: boolean;
  readonly allowedSources: readonly SourceId[];
  readonly allowedEngines: readonly EngineId[];
  readonly distillation: DistillationPolicy;
  readonly originScope: "strict";
  readonly blockedOrigins: readonly string[];
  readonly maxActionTier: ActionTier;
};

export const engineIds = [
  "claude-code",
  "codex",
  "cursor-agent",
  "antigravity",
  "anthropic-api",
  "openai-compatible",
] as const;

export const defaultManagedPolicy: ManagedPolicy = {
  enabled: true,
  allowedSources: sourceIds,
  allowedEngines: engineIds,
  distillation: "allowed",
  originScope: "strict",
  blockedOrigins: [],
  maxActionTier: "act",
};

const managedPolicySchema = z.object({
  enabled: z.boolean(),
  allowedSources: z.array(z.enum(sourceIds)),
  allowedEngines: z.array(z.enum(engineIds)),
  distillation: z.enum(["allowed", "local-only", "disabled"]),
  originScope: z.literal("strict"),
  blockedOrigins: z.array(z.string()),
  maxActionTier: z.enum(["observe", "draft", "act"]),
});

export function parseManagedPolicy(value: unknown): ManagedPolicy {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Managed policy must be a JSON object");
  }

  const result = managedPolicySchema.safeParse(value);
  if (!result.success) {
    throw new Error("Managed policy has invalid or missing fields");
  }

  return result.data;
}

export function applyManagedPolicy(options: {
  readonly config: ShadowcloneConfig;
  readonly policy: ManagedPolicy;
}): ShadowcloneConfig {
  const sourceAllowed = (source: SourceId): boolean =>
    options.policy.enabled && options.policy.allowedSources.includes(source);
  return {
    ...options.config,
    sources: {
      "agent-context": options.config.sources["agent-context"] && sourceAllowed("agent-context"),
      antigravity:
        options.config.sources.antigravity &&
        sourceAllowed("antigravity"),
      "claude-code":
        options.config.sources["claude-code"] &&
        sourceAllowed("claude-code"),
      "claude-prompts":
        options.config.sources["claude-prompts"] &&
        sourceAllowed("claude-prompts"),
      codex: options.config.sources.codex && sourceAllowed("codex"),
      cursor: options.config.sources.cursor && sourceAllowed("cursor"),
      "git-metadata":
        options.config.sources["git-metadata"] &&
        sourceAllowed("git-metadata"),
      shell: options.config.sources.shell && sourceAllowed("shell"),
    },
    distillation: {
      deep:
        options.config.distillation.deep &&
        options.policy.enabled &&
        options.policy.distillation !== "disabled",
    },
  };
}

export async function readManagedPolicy(
  managedConfigPath: string | null,
): Promise<ManagedPolicy> {
  if (managedConfigPath === null) {
    return defaultManagedPolicy;
  }
  const file = Bun.file(managedConfigPath);
  if (!(await file.exists())) {
    return defaultManagedPolicy;
  }
  const metadata = await stat(managedConfigPath);
  if (metadata.uid !== 0) {
    throw new Error("Managed policy must be owned by root");
  }
  const value: unknown = await file.json();
  return parseManagedPolicy(value);
}
