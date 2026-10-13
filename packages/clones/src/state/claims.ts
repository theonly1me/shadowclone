import { z } from "zod";
import { githubData, type GithubCall } from "../github";
import type { SessionConfig } from "../session/config";
import type { SessionRequest } from "../trigger/event";
import { shortHash } from "./sessionRef";

export const repositoryDailyRuns = 100;

export type ClaimOutcome =
  | { readonly kind: "claimed" }
  | { readonly kind: "duplicate" }
  | { readonly kind: "over-budget"; readonly scope: "branch" | "repository" };

const claimRefSchema = z.array(z.object({ ref: z.string() }));

const claimPattern =
  /^refs\/shadowclone\/claims\/(\d{4}-\d{2}-\d{2})\/([a-f0-9]{16})\/([a-f0-9]{16})$/;

function day(options: { readonly now: Date; readonly offsetDays: number }): string {
  return new Date(options.now.getTime() + options.offsetDays * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

async function removeExpiredClaims(options: {
  readonly github: GithubCall;
  readonly config: SessionConfig;
  readonly expired: readonly string[];
}): Promise<void> {
  for (const ref of options.expired) {
    await options.github({
      method: "DELETE",
      route: `repos/${options.config.repository}/git/${ref}`,
    });
  }
}

export async function claimRequest(options: {
  readonly github: GithubCall;
  readonly config: SessionConfig;
  readonly request: SessionRequest;
  readonly now: Date;
}): Promise<ClaimOutcome> {
  const { github, config, request } = options;
  const base = `repos/${config.repository}/git`;
  const today = day({ now: options.now, offsetDays: 0 });
  const yesterday = day({ now: options.now, offsetDays: -1 });
  const branchHash = shortHash(request.branch);
  const claims = claimRefSchema
    .parse(await githubData({ github, route: `${base}/matching-refs/shadowclone/claims/` }))
    .flatMap((entry) => {
      const match = claimPattern.exec(entry.ref);

      return match ? [{ ref: entry.ref, day: match[1], branch: match[2] }] : [];
    });

  await removeExpiredClaims({
    github,
    config,
    expired: claims
      .filter((claim) => claim.day !== today && claim.day !== yesterday)
      .map((claim) => claim.ref),
  });

  const todays = claims.filter((claim) => claim.day === today);

  if (todays.length >= repositoryDailyRuns) {
    return { kind: "over-budget", scope: "repository" };
  }

  if (todays.filter((claim) => claim.branch === branchHash).length >= config.maximumRuns) {
    return { kind: "over-budget", scope: "branch" };
  }

  const head = z
    .object({ object: z.object({ sha: z.string() }) })
    .parse(await githubData({ github, route: `${base}/ref/heads/${config.defaultBranch}` }))
    .object.sha;
  const created = await github({
    method: "POST",
    route: `${base}/refs`,
    body: {
      ref: `refs/shadowclone/claims/${today}/${branchHash}/${shortHash(request.key)}`,
      sha: head,
    },
  });

  if (created.status === 201) {
    return { kind: "claimed" };
  }

  if (created.status === 422) {
    return { kind: "duplicate" };
  }

  throw new Error(`GitHub refused the session claim (${created.status}).`);
}
