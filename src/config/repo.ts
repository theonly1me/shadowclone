import { z } from "zod";

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

const repoPolicySchema = z.strictObject({
  allow: z.array(z.enum(actionCapabilities)),
  maxBudgetUsd: z.number().positive(),
  requireCleanExit: z.boolean(),
});

export function parseRepoSettings(value: unknown): RepoSettings {
  if (value === undefined) {
    return {};
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Config repo settings must be tables");
  }

  const settings: Record<string, RepoPolicy> = {};

  for (const [repository, entry] of Object.entries(value)) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new Error("Every repo policy must be a table");
    }

    const result = repoPolicySchema.safeParse(entry);
    if (!result.success) {
      throw new Error("Every repo policy must contain valid action settings");
    }

    settings[repository] = result.data;
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
