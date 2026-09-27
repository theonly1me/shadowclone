import { normalizeRemoteRepository } from "../signal/origin/remote";
import { runCommand, type CommandRunner } from "./command";
import type { Worktree } from "./worktree";

export async function pushWorktree(options: {
  readonly worktree: Worktree;
  readonly repositoryId: string;
  readonly runner?: CommandRunner;
}): Promise<boolean> {
  const runner = options.runner ?? runCommand;
  const remote = await runner({
    command: ["git", "remote", "get-url", "--push", "--all", "origin"],
    cwd: options.worktree.repoDirectory,
  });
  const urls = remote.stdout.trim().split("\n");
  const [url] = urls;

  if (
    remote.exitCode !== 0 ||
    urls.length !== 1 ||
    !url ||
    normalizeRemoteRepository(url)?.id !== options.repositoryId
  ) {
    throw new Error("Push destination does not match the approved repository");
  }

  const result = await runner({
    command: [
      "git",
      "push",
      "--set-upstream",
      "origin",
      options.worktree.branch,
    ],
    cwd: options.worktree.worktreeDirectory,
  });

  if (result.exitCode !== 0) {
    throw new Error("Could not push the clone branch to origin");
  }

  return true;
}
