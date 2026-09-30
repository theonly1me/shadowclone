import path from "node:path";
import { readEffectiveConfig } from "../config";
import { runCommand, type CommandRunner } from "../dispatch/command";
import { canonicalPath, type ProjectPaths } from "../paths";
import { isOriginBlocked, resolveRepository } from "../signal";
import type { GateExecutor } from "../dispatch/gate";

export type TaskContext = {
  readonly cwd: string;
  readonly paths: ProjectPaths;
  readonly runner?: CommandRunner;
  readonly execute?: GateExecutor;
};

export async function taskCommand(
  options: TaskContext & { readonly command: readonly string[] },
): Promise<string> {
  const result = await (options.runner ?? runCommand)({
    command: options.command,
    cwd: options.cwd,
  });
  if (result.exitCode !== 0) throw new Error("Task repository command failed");
  return result.stdout;
}

export async function taskRepository(options: TaskContext) {
  const root = canonicalPath(
    (
      await taskCommand({
        ...options,
        command: ["git", "rev-parse", "--show-toplevel"],
      })
    ).trim(),
  );
  const commonDirectory = canonicalPath(
    (
      await taskCommand({
        ...options,
        command: [
          "git",
          "rev-parse",
          "--path-format=absolute",
          "--git-common-dir",
        ],
      })
    ).trim(),
  );
  const repositoryDirectory =
    path.basename(commonDirectory) === ".git"
      ? path.dirname(commonDirectory)
      : root;
  const { policy } = await readEffectiveConfig({
    configPath: options.paths.configFile,
    managedConfigPath: options.paths.managedConfigFile,
  });
  const repository = await resolveRepository({
    cwd: root,
    enabled: true,
    readRemote: async (cwd) => {
      const result = await (options.runner ?? runCommand)({
        command: ["git", "remote", "get-url", "origin"],
        cwd,
      });
      return result.exitCode === 0 ? result.stdout.trim() : null;
    },
  });
  if (
    !policy.enabled ||
    isOriginBlocked({ repository, patterns: policy.blockedOrigins })
  )
    throw new Error("Managed policy blocks tasks in this repository");
  const storage = canonicalPath(options.paths.shadowcloneDirectory);
  if (storage === root || storage.startsWith(`${root}${path.sep}`))
    throw new Error("Task storage must be outside the repository");
  return { root, commonDirectory, repositoryDirectory, repository, policy };
}
