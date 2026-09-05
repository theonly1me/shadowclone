import { stat } from "node:fs/promises";
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

const engineIds: readonly EngineId[] = [
  "claude-code",
  "codex",
  "cursor-agent",
  "antigravity",
  "anthropic-api",
  "openai-compatible",
];

export const defaultManagedPolicy: ManagedPolicy = {
  enabled: true,
  allowedSources: sourceIds,
  allowedEngines: engineIds,
  distillation: "allowed",
  originScope: "strict",
  blockedOrigins: [],
  maxActionTier: "act",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): readonly string[] | null {
  return Array.isArray(value) &&
    value.every((entry) => typeof entry === "string")
    ? value
    : null;
}

function parseSources(value: unknown): readonly SourceId[] | null {
  const values = stringArray(value);
  if (values === null) {
    return null;
  }
  const sources = values.flatMap((entry) => {
    const source = sourceIds.find((candidate) => candidate === entry);
    return source ? [source] : [];
  });
  return sources.length === values.length ? sources : null;
}

function parseEngines(value: unknown): readonly EngineId[] | null {
  const values = stringArray(value);
  if (values === null) {
    return null;
  }
  const engines = values.flatMap((entry) => {
    const engine = engineIds.find((candidate) => candidate === entry);
    return engine ? [engine] : [];
  });
  return engines.length === values.length ? engines : null;
}

export function parseManagedPolicy(value: unknown): ManagedPolicy {
  if (!isRecord(value)) {
    throw new Error("Managed policy must be a JSON object");
  }
  const allowedSources = parseSources(value.allowedSources);
  const allowedEngines = parseEngines(value.allowedEngines);
  const blockedOrigins = stringArray(value.blockedOrigins);
  const distillation = value.distillation;
  const maxActionTier = value.maxActionTier;
  if (
    typeof value.enabled !== "boolean" ||
    allowedSources === null ||
    allowedEngines === null ||
    blockedOrigins === null ||
    (distillation !== "allowed" &&
      distillation !== "local-only" &&
      distillation !== "disabled") ||
    value.originScope !== "strict" ||
    (maxActionTier !== "observe" &&
      maxActionTier !== "draft" &&
      maxActionTier !== "act")
  ) {
    throw new Error("Managed policy has invalid or missing fields");
  }
  return {
    enabled: value.enabled,
    allowedSources,
    allowedEngines,
    distillation,
    originScope: "strict",
    blockedOrigins,
    maxActionTier,
  };
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
