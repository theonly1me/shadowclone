import type { CloneConfig } from "../config/config";
import type { ResolvedClone } from "./resolve";
import type { Processes } from "./processes";
import type { Workspace } from "./workspace";

export const saveCommitMessage = "chore: save unfinished shadowclone work";

export type SaveOutcome = "saved" | "clean" | "skipped" | "push-failed";

export async function saveUnfinishedWork(options: {
  readonly config: CloneConfig;
  readonly clone: ResolvedClone;
  readonly workspace: Workspace;
  readonly processes: Processes;
}): Promise<SaveOutcome> {
  const { config, clone, processes } = options;
  const cwd = options.workspace.repository;
  const current = (
    await processes.run({ arguments: ["git", "branch", "--show-current"], cwd })
  ).stdout.trim();

  if (clone.kind === "review" || clone.branch === config.defaultBranch || current !== clone.branch) {
    return "skipped";
  }

  await processes.run({ arguments: ["git", "add", "-A"], cwd });

  const staged = await processes.run({ arguments: ["git", "diff", "--cached", "--quiet"], cwd });

  if (staged.exitCode !== 0) {
    await processes.run({ arguments: ["git", "commit", "--quiet", "-m", saveCommitMessage], cwd });
  }

  const tracked = await processes.run({
    arguments: ["git", "rev-parse", "--verify", "--quiet", `origin/${clone.branch}`],
    cwd,
  });
  const upstream =
    tracked.exitCode === 0 ? `origin/${clone.branch}` : `origin/${config.defaultBranch}`;
  const ahead = await processes.run({
    arguments: ["git", "rev-list", "--count", `${upstream}..HEAD`],
    cwd,
  });

  if (ahead.exitCode === 0 && ahead.stdout.trim() === "0") {
    return "clean";
  }

  const pushed = await processes.run({
    arguments: ["git", "push", "--quiet", "origin", `HEAD:refs/heads/${clone.branch}`],
    cwd,
  });

  return pushed.exitCode === 0 ? "saved" : "push-failed";
}
