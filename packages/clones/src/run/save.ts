import type { GithubCall } from "../github";
import type { SessionConfig } from "../session/config";
import { issuePaused, readEntity } from "../trigger/entity";
import type { SessionRequest } from "../trigger/event";
import type { Processes } from "./processes";
import type { Workspace } from "./workspace";

export const saveCommitMessage = "chore: save unfinished shadowclone work";

export type SaveOutcome = "saved" | "clean" | "paused" | "skipped" | "push-failed";

export async function saveUnfinishedWork(options: {
  readonly github: GithubCall;
  readonly config: SessionConfig;
  readonly request: SessionRequest;
  readonly workspace: Workspace;
  readonly processes: Processes;
}): Promise<SaveOutcome> {
  const { github, config, request, processes } = options;
  const cwd = options.workspace.repository;
  const current = (
    await processes.run({ arguments: ["git", "branch", "--show-current"], cwd })
  ).stdout.trim();

  if (
    request.kind === "review" ||
    request.branch === config.defaultBranch ||
    current !== request.branch
  ) {
    return "skipped";
  }

  if (
    (await readEntity({ github, config, entity: request.entity })).paused ||
    (await issuePaused({ github, config, branch: request.branch }))
  ) {
    return "paused";
  }

  await processes.run({ arguments: ["git", "add", "-A"], cwd });

  const staged = await processes.run({ arguments: ["git", "diff", "--cached", "--quiet"], cwd });

  if (staged.exitCode !== 0) {
    await processes.run({ arguments: ["git", "commit", "--quiet", "-m", saveCommitMessage], cwd });
  }

  const tracked = await processes.run({
    arguments: ["git", "rev-parse", "--verify", "--quiet", `origin/${request.branch}`],
    cwd,
  });
  const upstream =
    tracked.exitCode === 0 ? `origin/${request.branch}` : `origin/${config.defaultBranch}`;
  const ahead = await processes.run({
    arguments: ["git", "rev-list", "--count", `${upstream}..HEAD`],
    cwd,
  });

  if (ahead.exitCode === 0 && ahead.stdout.trim() === "0") {
    return "clean";
  }

  const pushed = await processes.run({
    arguments: ["git", "push", "--quiet", "origin", `HEAD:refs/heads/${request.branch}`],
    cwd,
  });

  return pushed.exitCode === 0 ? "saved" : "push-failed";
}
