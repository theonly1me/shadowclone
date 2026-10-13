import { z } from "zod";
import { githubData, type GithubCall } from "../github";
import type { SessionConfig } from "../session/config";
import { issueBranch, pausedLabel, sessionLabel } from "./event";

const labelsSchema = z.array(z.object({ name: z.string() }));

const issueSchema = z.object({
  number: z.number().int().positive(),
  state: z.string(),
  labels: labelsSchema,
  pull_request: z.unknown().optional(),
});

const pullSchema = z.object({
  number: z.number().int().positive(),
  state: z.string(),
  user: z.object({ id: z.number().int() }),
  labels: labelsSchema,
  head: z.object({
    ref: z.string(),
    sha: z.string().regex(/^[a-f0-9]{40}$/),
    repo: z.object({ id: z.number().int() }).nullable(),
  }),
});

export type Entity = {
  readonly number: number;
  readonly open: boolean;
  readonly paused: boolean;
  readonly session: boolean;
  readonly pull: {
    readonly branch: string;
    readonly head: string;
    readonly fork: boolean;
    readonly ownerAuthored: boolean;
  } | null;
};

const branchPattern = /^[A-Za-z0-9._/-]+$/;

export async function readEntity(options: {
  readonly github: GithubCall;
  readonly config: SessionConfig;
  readonly entity: number;
}): Promise<Entity> {
  const { github, config } = options;
  const issue = issueSchema.parse(
    await githubData({ github, route: `repos/${config.repository}/issues/${options.entity}` }),
  );
  const labels = issue.labels.map((label) => label.name);
  const shared = {
    number: issue.number,
    open: issue.state === "open",
    paused: labels.includes(pausedLabel),
    session: labels.includes(sessionLabel),
  };

  if (issue.pull_request === undefined || issue.pull_request === null) {
    return { ...shared, pull: null };
  }

  const pull = pullSchema.parse(
    await githubData({ github, route: `repos/${config.repository}/pulls/${options.entity}` }),
  );

  return {
    ...shared,
    open: pull.state === "open",
    pull: {
      branch: pull.head.ref,
      head: pull.head.sha,
      fork: pull.head.repo?.id !== config.repositoryId,
      ownerAuthored: pull.user.id === config.ownerId,
    },
  };
}

export function entityBranch(entity: Entity): string | null {
  const branch = entity.pull === null ? issueBranch(entity.number) : entity.pull.branch;

  return branchPattern.test(branch) ? branch : null;
}

export async function issuePaused(options: {
  readonly github: GithubCall;
  readonly config: SessionConfig;
  readonly branch: string;
}): Promise<boolean> {
  const issue = /^shadowclone\/issue-(\d+)$/.exec(options.branch)?.[1];

  if (issue === undefined) {
    return false;
  }

  return (await readEntity({ ...options, entity: Number(issue) })).paused;
}
