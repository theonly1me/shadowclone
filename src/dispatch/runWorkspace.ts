import path from "node:path";
import { compileAgentDelivery } from "../environment/compile";
import { materializeSkillDelivery } from "../environment/delivery";
import type { ProjectPaths } from "../paths";
import type { ProfileCompilation } from "../profile";
import type { RepositoryIdentity } from "../signal";
import type { CommandRunner } from "./command";
import { prepareWorktreeDependencies } from "./gatedCommit";
import { createWorktree, type Worktree } from "./worktree";

export async function prepareRunWorkspace(options: {
  readonly runId?: string;
  readonly targetDirectory: string;
  readonly paths: ProjectPaths;
  readonly repository: RepositoryIdentity;
  readonly commandRunner?: CommandRunner;
}): Promise<{
  readonly runId: string;
  readonly branch: string;
  readonly worktree: Worktree;
  readonly compiledProfilePath: string;
  readonly compilation: ProfileCompilation;
}> {
  const { targetDirectory, paths, repository } = options;

  const runId = options.runId ?? crypto.randomUUID();

  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(runId)) {
    throw new Error("Invalid run id");
  }

  const slug = "task";
  const branch = `shadowclone/${slug}-${runId.slice(0, 8)}`;
  const worktree = await createWorktree({
    targetDirectory,
    worktreeDirectory: paths.worktreeDirectory(runId),
    branch,
    runner: options.commandRunner,
  });

  await prepareWorktreeDependencies({
    worktree,
    runner: options.commandRunner,
  });

  const compiledProfilePath = path.join(
    paths.runDirectory(runId),
    "guidance.md",
  );
  const compilation = await compileAgentDelivery({
    paths,
    cwd: targetDirectory,
    repository,
    outputPath: compiledProfilePath,
  });
  const skills = await materializeSkillDelivery({
    paths,
    repositoryDirectory: targetDirectory,
    destination: worktree.worktreeDirectory,
  });

  if (skills !== null) {
    await Bun.write(compiledProfilePath, skills, { mode: 0o600 });
  }

  return { runId, branch, worktree, compiledProfilePath, compilation };
}
