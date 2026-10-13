import { z } from "zod";
import { githubData, type GithubCall } from "../github";

export const sessionsRulesetName = "shadowclone sessions default branch";

export const sessionsRuleset = {
  name: sessionsRulesetName,
  target: "branch",
  enforcement: "active",
  bypass_actors: [],
  conditions: { ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] } },
  rules: [
    {
      type: "pull_request",
      parameters: {
        required_approving_review_count: 0,
        dismiss_stale_reviews_on_push: false,
        require_code_owner_review: false,
        require_last_push_approval: false,
        required_review_thread_resolution: false,
      },
    },
    { type: "non_fast_forward" },
    { type: "deletion" },
  ],
} as const;

export const sessionsRulesetSummary =
  'Add the ruleset "shadowclone sessions default branch": every change to the default branch goes through a pull request, with no bypass for anyone, including you. Force pushes and deletion are blocked.';

const summariesSchema = z.array(z.object({ id: z.number().int().positive(), name: z.string() }));

const storedSchema = z.object({
  id: z.number().int().positive(),
  enforcement: z.string(),
  rules: z.array(z.object({ type: z.string() })),
  bypass_actors: z.array(z.unknown()).default([]),
});

export async function ensureSessionsRuleset(options: {
  readonly github: GithubCall;
  readonly repository: string;
}): Promise<"created" | "present"> {
  const { github } = options;
  const base = `repos/${options.repository}/rulesets`;
  const existing = summariesSchema
    .parse(await githubData({ github, route: `${base}?per_page=100&includes_parents=false` }))
    .find((ruleset) => ruleset.name === sessionsRulesetName);

  if (existing === undefined) {
    await githubData({ github, method: "POST", route: base, body: sessionsRuleset });
    return "created";
  }

  const stored = storedSchema.parse(await githubData({ github, route: `${base}/${existing.id}` }));
  const types = stored.rules.map((rule) => rule.type);

  if (
    stored.enforcement !== "active" ||
    stored.bypass_actors.length > 0 ||
    !types.includes("pull_request")
  ) {
    throw new Error(
      `The ${sessionsRulesetName} ruleset differs from the rules that setup expects. Restore or delete it, then run setup again: https://github.com/${options.repository}/settings/rules/${existing.id}`,
    );
  }

  return "present";
}
