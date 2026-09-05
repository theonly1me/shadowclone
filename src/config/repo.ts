export const actionCapabilities = [
  "push",
  "pr-draft",
  "pr-reply",
] as const;

export type ActionCapability = (typeof actionCapabilities)[number];

export type RepoPolicy = {
  readonly allow: readonly ActionCapability[];
  readonly maxBudgetUsd: number;
  readonly requireCleanExit: boolean;
};

export type RepoSettings = Readonly<Record<string, RepoPolicy>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseAllow(value: unknown): readonly ActionCapability[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const capabilities = value.flatMap((entry) => {
    const capability = actionCapabilities.find(
      (candidate) => candidate === entry,
    );
    return capability ? [capability] : [];
  });
  return capabilities.length === value.length ? capabilities : null;
}

export function parseRepoSettings(value: unknown): RepoSettings {
  if (value === undefined) {
    return {};
  }
  if (!isRecord(value)) {
    throw new Error("Config repo settings must be tables");
  }

  const settings: Record<string, RepoPolicy> = {};
  for (const [repository, entry] of Object.entries(value)) {
    if (!isRecord(entry)) {
      throw new Error("Every repo policy must be a table");
    }
    const allow = parseAllow(entry.allow);
    if (
      allow === null ||
      typeof entry.maxBudgetUsd !== "number" ||
      entry.maxBudgetUsd <= 0 ||
      typeof entry.requireCleanExit !== "boolean" ||
      Object.keys(entry).some(
        (key) =>
          key !== "allow" &&
          key !== "maxBudgetUsd" &&
          key !== "requireCleanExit",
      )
    ) {
      throw new Error("Every repo policy must contain valid action settings");
    }
    settings[repository] = {
      allow,
      maxBudgetUsd: entry.maxBudgetUsd,
      requireCleanExit: entry.requireCleanExit,
    };
  }
  return settings;
}

export function renderRepoSettings(settings: RepoSettings): readonly string[] {
  return Object.entries(settings)
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([repository, policy]) => [
      "",
      `[repo.${JSON.stringify(repository)}]`,
      `allow = [${policy.allow.map((value) => JSON.stringify(value)).join(", ")}]`,
      `maxBudgetUsd = ${policy.maxBudgetUsd}`,
      `requireCleanExit = ${policy.requireCleanExit}`,
    ]);
}
