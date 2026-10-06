import { z } from "zod";
import type { Repository } from "../types";
import type { GhCommand } from "./github";

const repositoryRoleIds = { admin: 5, maintain: 2, write: 4 } as const;

export const defaultBranchRuleset = {
  name: "shadowclone default branch",
  target: "branch",
  enforcement: "active",
  conditions: { ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] } },
  rules: [
    { type: "update", parameters: { update_allows_fetch_and_merge: false } },
    { type: "deletion" },
  ],
  bypass_actors: Object.values(repositoryRoleIds).map((roleId) => ({
    actor_id: roleId,
    actor_type: "RepositoryRole",
    bypass_mode: "exempt",
  })),
} as const;

const summarySchema = z.array(z.object({ id: z.number().int().positive(), name: z.string() }));

const rulesetSchema = z.object({
  id: z.number().int().positive(),
  target: z.string(),
  enforcement: z.string(),
  conditions: z
    .object({
      ref_name: z.object({ include: z.array(z.string()), exclude: z.array(z.string()) }),
    })
    .nullable(),
  rules: z.array(
    z.object({
      type: z.string(),
      parameters: z.record(z.string(), z.unknown()).optional(),
    }),
  ),
  bypass_actors: z
    .array(
      z.object({
        actor_id: z.number().nullable(),
        actor_type: z.string(),
        bypass_mode: z.string(),
      }),
    )
    .default([]),
});

type Ruleset = z.infer<typeof rulesetSchema>;

function sortedKeys(values: readonly string[]): string {
  return [...values].sort().join(",");
}

function isDefaultBranchRuleset(ruleset: Ruleset): boolean {
  const update = ruleset.rules.find((rule) => rule.type === "update");
  const bypass = ruleset.bypass_actors.map(
    (actor) => `${actor.actor_type}:${actor.actor_id}:${actor.bypass_mode}`,
  );
  const expectedBypass = defaultBranchRuleset.bypass_actors.map(
    (actor) => `${actor.actor_type}:${actor.actor_id}:${actor.bypass_mode}`,
  );

  return (
    ruleset.target === "branch" &&
    ruleset.enforcement === "active" &&
    sortedKeys(ruleset.conditions?.ref_name.include ?? []) === "~DEFAULT_BRANCH" &&
    (ruleset.conditions?.ref_name.exclude.length ?? 0) === 0 &&
    sortedKeys(ruleset.rules.map((rule) => rule.type)) === "deletion,update" &&
    (update?.parameters?.update_allows_fetch_and_merge ?? false) === false &&
    sortedKeys(bypass) === sortedKeys(expectedBypass)
  );
}

export async function protectDefaultBranch(options: {
  readonly repository: Repository;
  readonly command: GhCommand;
}): Promise<void> {
  const base = `repos/${options.repository.full_name}/rulesets`;
  const summaries = summarySchema.parse(
    JSON.parse(
      await options.command({
        arguments: ["api", `${base}?per_page=100&includes_parents=false`],
      }),
    ),
  );

  if (summaries.length >= 100) {
    throw new Error("Review the repository rulesets before setup.");
  }

  const existing = summaries.find((ruleset) => ruleset.name === defaultBranchRuleset.name);
  const id =
    existing?.id ??
    rulesetSchema.parse(
      JSON.parse(
        await options.command({
          arguments: ["api", "--method", "POST", base, "--input", "-"],
          input: JSON.stringify(defaultBranchRuleset),
        }),
      ),
    ).id;

  const verified = rulesetSchema.parse(
    JSON.parse(await options.command({ arguments: ["api", `${base}/${id}`] })),
  );

  if (!isDefaultBranchRuleset(verified)) {
    throw new Error(
      existing
        ? "Review the existing shadowclone default branch ruleset before setup."
        : "The default branch ruleset could not be verified.",
    );
  }
}
