import { z } from "zod";
import type { CloneConfig } from "../config/config";
import { githubData, type GithubCall } from "../github";
import type { CloneRequest } from "../node/request";

export const cloneLabel = "shadowclone";

export type PullFacts = {
  readonly number: number;
  readonly branch: string;
  readonly head: string;
  readonly fork: boolean;
  readonly ownerAuthored: boolean;
};

export type ResolvedClone =
  | {
      readonly kind: "work";
      readonly id: string;
      readonly task: string;
      readonly branch: string;
      readonly issue: number | null;
      readonly pull: PullFacts | null;
    }
  | { readonly kind: "review"; readonly id: string; readonly branch: string; readonly pull: PullFacts };

export type Resolution =
  | { readonly kind: "resolved"; readonly clone: ResolvedClone }
  | { readonly kind: "refused"; readonly reason: string };

const branchPattern = /^[A-Za-z0-9_][A-Za-z0-9._/-]*$/;

const issueSchema = z.object({
  number: z.number().int().positive(),
  state: z.string(),
  pull_request: z.unknown().optional(),
});

const pullSchema = z.object({
  number: z.number().int().positive(),
  state: z.string(),
  user: z.object({ id: z.number().int() }),
  head: z.object({
    ref: z.string(),
    sha: z.string().regex(/^[a-f0-9]{40}$/),
    repo: z.object({ id: z.number().int() }).nullable(),
  }),
});

export function issueBranch(issue: number): string {
  return `shadowclone/issue-${issue}`;
}

async function readPull(options: {
  readonly github: GithubCall;
  readonly config: CloneConfig;
  readonly number: number;
}): Promise<PullFacts & { readonly open: boolean }> {
  const { config } = options;
  const pull = pullSchema.parse(
    await githubData({
      github: options.github,
      route: `repos/${config.repository}/pulls/${options.number}`,
    }),
  );

  return {
    number: pull.number,
    open: pull.state === "open",
    branch: pull.head.ref,
    head: pull.head.sha,
    fork: pull.head.repo?.id !== config.repositoryId,
    ownerAuthored: pull.user.id === config.ownerId,
  };
}

function refused(reason: string): Resolution {
  return { kind: "refused", reason };
}

export async function resolveClone(options: {
  readonly github: GithubCall;
  readonly config: CloneConfig;
  readonly request: CloneRequest;
}): Promise<Resolution> {
  const { github, config, request } = options;

  if (request.kind === "review") {
    const { open, ...pull } = await readPull({ github, config, number: request.pull });

    return open
      ? { kind: "resolved", clone: { kind: "review", id: request.id, branch: pull.branch, pull } }
      : refused(`Pull request #${request.pull} is closed.`);
  }

  const work = { kind: "work", id: request.id, task: request.task } as const;
  const { target } = request;

  if (target.kind === "new") {
    return {
      kind: "resolved",
      clone: { ...work, branch: `shadowclone/${request.id}`, issue: null, pull: null },
    };
  }

  if (target.kind === "issue") {
    const issue = issueSchema.parse(
      await githubData({ github, route: `repos/${config.repository}/issues/${target.number}` }),
    );

    if (issue.pull_request !== undefined && issue.pull_request !== null) {
      return refused(`#${target.number} is a pull request. Start the clone with --pull instead.`);
    }

    return issue.state === "open"
      ? {
          kind: "resolved",
          clone: { ...work, branch: issueBranch(target.number), issue: target.number, pull: null },
        }
      : refused(`Issue #${target.number} is closed.`);
  }

  const { open, ...pull } = await readPull({ github, config, number: target.number });

  if (!open) {
    return refused(`Pull request #${target.number} is closed.`);
  }

  if (pull.fork) {
    return refused("A clone cannot push to a fork. Start a review of the pull request instead.");
  }

  return branchPattern.test(pull.branch)
    ? { kind: "resolved", clone: { ...work, branch: pull.branch, issue: null, pull } }
    : refused(`The branch name of pull request #${target.number} is not safe to use.`);
}
