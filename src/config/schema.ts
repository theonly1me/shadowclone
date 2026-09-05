export const sourceIds = [
  "claude-code",
  "claude-prompts",
  "codex",
  "cursor",
  "git-metadata",
  "shell",
] as const;

export type SourceId = (typeof sourceIds)[number];

const legacySourceIds = sourceIds.filter(
  (sourceId) => sourceId !== "git-metadata",
);

export type SourceSettings = {
  readonly [Source in SourceId]: boolean;
};

export type ShadowcloneConfig = {
  readonly schemaVersion: 1;
  readonly sources: SourceSettings;
  readonly distillation: {
    readonly deep: boolean;
  };
};

export const defaultConfig: ShadowcloneConfig = {
  schemaVersion: 1,
  sources: {
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
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(options: {
  readonly record: Record<string, unknown>;
  readonly keys: readonly string[];
}): boolean {
  const actualKeys = Object.keys(options.record);
  const expectedKeys = new Set(options.keys);

  return (
    actualKeys.length === options.keys.length &&
    actualKeys.every((key) => expectedKeys.has(key))
  );
}

function parseSources(value: unknown): SourceSettings {
  if (
    !isRecord(value) ||
    (!hasExactKeys({ record: value, keys: sourceIds }) &&
      !hasExactKeys({ record: value, keys: legacySourceIds }))
  ) {
    throw new Error("Config sources must contain every supported source and no unknown sources");
  }

  const claudeCode = value["claude-code"];
  const claudePrompts = value["claude-prompts"];
  const codex = value.codex;
  const cursor = value.cursor;
  const gitMetadata = value["git-metadata"] ?? false;
  const shell = value.shell;

  if (
    typeof claudeCode !== "boolean" ||
    typeof claudePrompts !== "boolean" ||
    typeof codex !== "boolean" ||
    typeof cursor !== "boolean" ||
    typeof gitMetadata !== "boolean" ||
    typeof shell !== "boolean"
  ) {
    throw new Error("Every config source setting must be a boolean");
  }

  return {
    "claude-code": claudeCode,
    "claude-prompts": claudePrompts,
    codex,
    cursor,
    "git-metadata": gitMetadata,
    shell,
  };
}

function parseDistillation(value: unknown): ShadowcloneConfig["distillation"] {
  if (!isRecord(value) || !hasExactKeys({ record: value, keys: ["deep"] })) {
    throw new Error("Config distillation must contain only the deep setting");
  }

  if (typeof value.deep !== "boolean") {
    throw new Error("Config distillation.deep must be a boolean");
  }

  return { deep: value.deep };
}

export function parseConfig(value: unknown): ShadowcloneConfig {
  if (
    !isRecord(value) ||
    !hasExactKeys({
      record: value,
      keys: ["schema-version", "sources", "distillation"],
    })
  ) {
    throw new Error("Config must contain schema-version, sources, and distillation");
  }

  if (value["schema-version"] !== 1) {
    throw new Error("Config schema-version must be 1");
  }

  return {
    schemaVersion: 1,
    sources: parseSources(value.sources),
    distillation: parseDistillation(value.distillation),
  };
}
