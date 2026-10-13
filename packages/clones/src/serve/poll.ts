import { z } from "zod";
import { githubData, type GithubCall } from "../github";
import type { SessionConfig } from "../session/config";
import { listSessionHeads } from "../state/sessionRef";
import { parseSessionCommand, sessionLabel, type SessionEvent } from "../trigger/event";

export const repositoryCursorSchema = z.strictObject({
  since: z.string(),
  seen: z.record(z.string(), z.string()),
});

export type RepositoryCursor = z.infer<typeof repositoryCursorSchema>;

const overlapMilliseconds = 60_000;
const seenMilliseconds = 2 * 86_400_000;
const pageSize = 100;

const commentSchema = z.object({
  id: z.number().int().positive(),
  body: z.string().nullable(),
  updated_at: z.string(),
  user: z.object({ id: z.number().int(), login: z.string(), type: z.string() }).nullable(),
  issue_url: z.string().optional(),
  pull_request_url: z.string().optional(),
});

const runsSchema = z.object({
  workflow_runs: z.array(
    z.object({ id: z.number().int().positive(), head_sha: z.string(), updated_at: z.string() }),
  ),
});

const labelsSchema = z.object({ labels: z.array(z.object({ name: z.string() })) });

type Candidate = { readonly key: string; readonly updatedAt: string; readonly event: SessionEvent };

function entityNumber(url: string | undefined): number | null {
  const number = Number(/\/(\d+)$/.exec(url ?? "")?.[1]);

  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

async function commentCandidates(options: {
  readonly github: GithubCall;
  readonly config: SessionConfig;
  readonly since: string;
  readonly source: "issue_comment" | "pull_request_review_comment";
}): Promise<{ readonly candidates: readonly Candidate[]; readonly full: boolean }> {
  const { github, config, source } = options;
  const collection = source === "issue_comment" ? "issues" : "pulls";
  const comments = z.array(commentSchema).parse(
    await githubData({
      github,
      route: `repos/${config.repository}/${collection}/comments?since=${encodeURIComponent(options.since)}&sort=updated&direction=asc&per_page=${pageSize}`,
    }),
  );
  const candidates: Candidate[] = [];

  for (const comment of comments) {
    const entity = entityNumber(
      source === "issue_comment" ? comment.issue_url : comment.pull_request_url,
    );
    const user = comment.user;
    const ownerCommand =
      user?.id === config.ownerId && parseSessionCommand(comment.body ?? "") !== null;
    const reviewerBot = user?.type === "Bot" && config.reviewerBots.includes(user.login);

    if (entity === null || (!ownerCommand && !reviewerBot)) {
      continue;
    }

    if (reviewerBot && !ownerCommand) {
      const issue = labelsSchema.parse(
        await githubData({ github, route: `repos/${config.repository}/issues/${entity}` }),
      );

      if (!issue.labels.some((label) => label.name === sessionLabel)) {
        continue;
      }
    }

    candidates.push({
      key: `${source}:${comment.id}:${comment.updated_at}`,
      updatedAt: comment.updated_at,
      event: { kind: "comment", source, id: comment.id, entity },
    });
  }

  return { candidates, full: comments.length === pageSize };
}

async function ciCandidates(options: {
  readonly github: GithubCall;
  readonly config: SessionConfig;
  readonly since: string;
}): Promise<readonly Candidate[]> {
  const heads = await listSessionHeads(options);

  if (heads.size === 0) {
    return [];
  }

  const runs = runsSchema.parse(
    await githubData({
      github: options.github,
      route: `repos/${options.config.repository}/actions/runs?status=completed&per_page=${pageSize}`,
    }),
  );

  return runs.workflow_runs
    .filter(
      (run) => heads.has(run.head_sha) && Date.parse(run.updated_at) >= Date.parse(options.since),
    )
    .map((run) => ({
      key: `workflow_run:${run.id}`,
      updatedAt: run.updated_at,
      event: { kind: "ci", runId: run.id },
    }));
}

export function startingCursor(now: Date): RepositoryCursor {
  return { since: now.toISOString(), seen: {} };
}

export async function pollRepository(options: {
  readonly github: GithubCall;
  readonly config: SessionConfig;
  readonly cursor: RepositoryCursor;
  readonly now: Date;
}): Promise<{ readonly events: readonly SessionEvent[]; readonly cursor: RepositoryCursor }> {
  const { github, config, cursor, now } = options;
  const issueComments = await commentCandidates({
    github,
    config,
    since: cursor.since,
    source: "issue_comment",
  });
  const reviewComments = await commentCandidates({
    github,
    config,
    since: cursor.since,
    source: "pull_request_review_comment",
  });
  const candidates = [
    ...issueComments.candidates,
    ...reviewComments.candidates,
    ...(await ciCandidates({ github, config, since: cursor.since })),
  ];
  const fresh = candidates.filter((candidate) => cursor.seen[candidate.key] === undefined);
  const latest = candidates
    .map((candidate) => candidate.updatedAt)
    .sort((left, right) => Date.parse(left) - Date.parse(right))
    .at(-1);
  const pageWasFull = issueComments.full || reviewComments.full;
  const since =
    pageWasFull && latest !== undefined
      ? latest
      : new Date(now.getTime() - overlapMilliseconds).toISOString();
  const seen = Object.fromEntries(
    [
      ...Object.entries(cursor.seen),
      ...fresh.map((candidate) => [candidate.key, now.toISOString()] as const),
    ].filter(([, at]) => now.getTime() - Date.parse(at) < seenMilliseconds),
  );

  return {
    events: fresh.map((candidate) => candidate.event),
    cursor: { since: Date.parse(since) > Date.parse(cursor.since) ? since : cursor.since, seen },
  };
}
