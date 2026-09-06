import { z } from "zod";
import type { RepoSettings } from "./repo";
import { parseRepoSettings } from "./repo";

export const sourceIds = [
  "agent-context",
  "antigravity",
  "claude-code",
  "claude-prompts",
  "codex",
  "cursor",
  "git-metadata",
  "shell",
] as const;

export type SourceId = (typeof sourceIds)[number];

export type SourceSettings = {
  readonly [Source in SourceId]: boolean;
};

export type ShadowcloneConfig = {
  readonly schemaVersion: 1;
  readonly sources: SourceSettings;
  readonly distillation: {
    readonly deep: boolean;
  };
  readonly repo: RepoSettings;
};

export const defaultConfig: ShadowcloneConfig = {
  schemaVersion: 1,
  sources: {
    "agent-context": false,
    antigravity: false,
    "claude-code": false,
    "claude-prompts": false,
    codex: false,
    cursor: false,
    "git-metadata": false,
    shell: false,
  },
  distillation: {
    deep: false,
  },
  repo: {},
};

const sourcesSchema = z
  .strictObject({
    "agent-context": z.boolean().optional().default(false),
    antigravity: z.boolean().optional().default(false),
    "claude-code": z.boolean(),
    "claude-prompts": z.boolean(),
    codex: z.boolean(),
    cursor: z.boolean(),
    "git-metadata": z.boolean().optional().default(false),
    shell: z.boolean(),
  });

const requiredCoreSourceIds = [
  "claude-code",
  "claude-prompts",
  "codex",
  "cursor",
  "shell",
] as const;

function hasUnknownKey(issues: readonly z.core.$ZodIssue[]): boolean {
  return issues.some((issue) => issue.code === "unrecognized_keys");
}

function parseSources(value: unknown): SourceSettings {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(
      "Config sources must contain every supported source and no unknown sources",
    );
  }

  const result = sourcesSchema.safeParse(value);
  if (!result.success) {
    const missingCore = requiredCoreSourceIds.some((key) => !(key in value));
    if (hasUnknownKey(result.error.issues) || missingCore) {
      throw new Error(
        "Config sources must contain every supported source and no unknown sources",
      );
    }

    throw new Error("Every config source setting must be a boolean");
  }

  return result.data;
}

const distillationSchema = z.strictObject({
  deep: z.boolean(),
});

function parseDistillation(value: unknown): ShadowcloneConfig["distillation"] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Config distillation must contain only the deep setting");
  }

  const result = distillationSchema.safeParse(value);
  if (!result.success) {
    if (hasUnknownKey(result.error.issues) || !("deep" in value)) {
      throw new Error("Config distillation must contain only the deep setting");
    }

    throw new Error("Config distillation.deep must be a boolean");
  }

  return result.data;
}

const configSchema = z.strictObject({
  "schema-version": z.literal(1),
  sources: z.unknown(),
  distillation: z.unknown(),
  repo: z.unknown().optional(),
});

export function parseConfig(value: unknown): ShadowcloneConfig {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Config must contain only supported top-level settings");
  }

  const result = configSchema.safeParse(value);
  if (!result.success) {
    const wrongSchemaVersion =
      "schema-version" in value &&
      result.error.issues.some((issue) =>
        issue.path.includes("schema-version"),
      );

    throw new Error(
      wrongSchemaVersion
        ? "Config schema-version must be 1"
        : "Config must contain only supported top-level settings",
    );
  }

  return {
    schemaVersion: 1,
    sources: parseSources(result.data.sources),
    distillation: parseDistillation(result.data.distillation),
    repo: parseRepoSettings(result.data.repo),
  };
}
