import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
  runCommand,
  type CommandRunner,
} from "./command";

export type Worktree = {
  readonly repoDirectory: string;
  readonly worktreeDirectory: string;
  readonly baseCommit: string;
  readonly branch: string;
};

async function requiredOutput(options: {
  readonly runner: CommandRunner;
  readonly command: readonly string[];
  readonly cwd: string;
  readonly failure: string;
}): Promise<string> {
  const result = await options.runner({
    command: options.command,
    cwd: options.cwd,
  });
  const output = result.stdout.trim();
  if (result.exitCode !== 0 || output.length === 0) {
    throw new Error(options.failure);
  }
  return output;
}

export async function createWorktree(options: {
  readonly targetDirectory: string;
  readonly worktreeDirectory: string;
  readonly branch: string;
  readonly runner?: CommandRunner;
}): Promise<Worktree> {
  const runner = options.runner ?? runCommand;
  const repoDirectory = await requiredOutput({
    runner,
    command: ["git", "rev-parse", "--show-toplevel"],
    cwd: options.targetDirectory,
    failure: "Target directory is not a git repository",
  });
  const baseCommit = await requiredOutput({
    runner,
    command: ["git", "rev-parse", "HEAD"],
    cwd: repoDirectory,
    failure: "Target repository has no current commit",
  });
  await mkdir(path.dirname(options.worktreeDirectory), { recursive: true });
  const result = await runner({
    command: [
      "git",
      "worktree",
      "add",
      options.worktreeDirectory,
      "-b",
      options.branch,
      baseCommit,
    ],
    cwd: repoDirectory,
  });
  if (result.exitCode !== 0) {
    throw new Error("Could not create the clone worktree");
  }
  return {
    repoDirectory,
    worktreeDirectory: options.worktreeDirectory,
    baseCommit,
    branch: options.branch,
  };
}

export async function inspectWorktree(options: {
  readonly worktree: Worktree;
  readonly runner?: CommandRunner;
}): Promise<{
  readonly filesChanged: readonly string[];
  readonly commits: readonly string[];
  readonly isClean: boolean;
}> {
  const runner = options.runner ?? runCommand;
  const [status, diff, log] = await Promise.all([
    runner({
      command: ["git", "status", "--porcelain"],
      cwd: options.worktree.worktreeDirectory,
    }),
    runner({
      command: [
        "git",
        "diff",
        "--name-only",
        `${options.worktree.baseCommit}..HEAD`,
      ],
      cwd: options.worktree.worktreeDirectory,
    }),
    runner({
      command: [
        "git",
        "log",
        "--format=%H",
        `${options.worktree.baseCommit}..HEAD`,
      ],
      cwd: options.worktree.worktreeDirectory,
    }),
  ]);
  const uncommittedFiles =
    status.exitCode === 0
      ? status.stdout
          .split("\n")
          .filter(Boolean)
          .map((line) => line.slice(3))
      : [];
  const committedFiles =
    diff.exitCode === 0 ? diff.stdout.split("\n").filter(Boolean) : [];
  return {
    filesChanged: [...new Set([...committedFiles, ...uncommittedFiles])],
    commits:
      log.exitCode === 0 ? log.stdout.split("\n").filter(Boolean) : [],
    isClean: status.exitCode === 0 && uncommittedFiles.length === 0,
  };
}

export async function commitWorktree(options: {
  readonly worktree: Worktree;
  readonly runner?: CommandRunner;
}): Promise<boolean> {
  const runner = options.runner ?? runCommand;
  const status = await runner({
    command: ["git", "status", "--porcelain"],
    cwd: options.worktree.worktreeDirectory,
  });
  if (status.exitCode !== 0) {
    throw new Error("Could not inspect the clone worktree");
  }
  if (status.stdout.trim().length === 0) {
    return false;
  }
  const staged = await runner({
    command: ["git", "add", "--all"],
    cwd: options.worktree.worktreeDirectory,
  });
  const committed =
    staged.exitCode === 0
      ? await runner({
          command: [
            "git",
            "commit",
            "-m",
            "chore: apply shadowclone task",
          ],
          cwd: options.worktree.worktreeDirectory,
        })
      : null;
  if (committed === null || committed.exitCode !== 0) {
    throw new Error("Could not commit the clone result");
  }
  return true;
}
