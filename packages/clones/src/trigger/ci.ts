import { z } from "zod";
import { githubData, type GithubCall } from "../github";
import type { SessionConfig } from "../session/config";
import { readSessionHead } from "../state/sessionRef";
import { sessionRunning } from "../state/statusComment";
import { issuePaused, readEntity } from "./entity";
import { ignored, type Resolution } from "./event";

const runSchema = z.object({
  id: z.number().int().positive(),
  status: z.string(),
  conclusion: z.string().nullable(),
  path: z.string(),
  head_branch: z.string().nullable(),
  head_sha: z.string().regex(/^[a-f0-9]{40}$/),
  head_repository: z.object({ id: z.number().int() }).nullable(),
});

const runsSchema = z.object({ workflow_runs: z.array(runSchema) });

const pullListSchema = z.array(
  z.object({ number: z.number().int().positive(), head: z.object({ ref: z.string() }) }),
);

const unfinishedStatuses = ["queued", "in_progress", "requested", "pending", "waiting"];

export async function resolveCi(options: {
  readonly github: GithubCall;
  readonly config: SessionConfig;
  readonly runId: number;
  readonly now: Date;
}): Promise<Resolution> {
  const { github, config } = options;
  const run = runSchema.parse(
    await githubData({ github, route: `repos/${config.repository}/actions/runs/${options.runId}` }),
  );
  const branch = run.head_branch;

  if (
    run.status !== "completed" ||
    ["cancelled", "skipped"].includes(run.conclusion ?? "") ||
    run.head_repository?.id !== config.repositoryId ||
    run.path.includes("shadowclone") ||
    branch === null
  ) {
    return ignored("The CI run is not a finished run on a branch of this repository.");
  }

  if ((await readSessionHead({ github, config, branch })) !== run.head_sha) {
    return ignored("The session did not push this commit last.");
  }

  const siblings = runsSchema.parse(
    await githubData({
      github,
      route: `repos/${config.repository}/actions/runs?head_sha=${run.head_sha}&per_page=100`,
    }),
  );

  if (
    siblings.workflow_runs.some(
      (sibling) =>
        !sibling.path.includes("shadowclone") && unfinishedStatuses.includes(sibling.status),
    )
  ) {
    return ignored("Other CI runs on this commit are still running.");
  }

  const owner = config.repository.split("/")[0] ?? "";
  const pulls = pullListSchema.parse(
    await githubData({
      github,
      route: `repos/${config.repository}/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}&per_page=100`,
    }),
  );
  const pull = pulls.find((candidate) => candidate.head.ref === branch);

  if (pull === undefined) {
    return ignored("The session branch has no open pull request.");
  }

  const entity = await readEntity({ github, config, entity: pull.number });

  if (!entity.open || !entity.session || entity.pull?.head !== run.head_sha) {
    return ignored("The pull request moved on, or it is not a session pull request.");
  }

  if (entity.paused || (await issuePaused({ github, config, branch }))) {
    return ignored("The work is paused.");
  }

  if (await sessionRunning({ github, config, entity: pull.number, now: options.now })) {
    return ignored("A session is already working on this pull request.");
  }

  return {
    kind: "accepted",
    request: {
      kind: "continue",
      source: "workflow_run",
      identifier: run.id,
      entity: pull.number,
      pull: true,
      branch,
      head: run.head_sha,
      ownerAuthored: entity.pull.ownerAuthored,
      fork: false,
      key: `workflow_run:${run.head_sha}`,
      task: "",
    },
  };
}
