import { existsSync } from "node:fs";
import { cp, lstat, realpath, rm, symlink } from "node:fs/promises";
import path from "node:path";

const supportedLockfiles = [
  "bun.lock",
  "bun.lockb",
  "package-lock.json",
  "pnpm-lock.yaml",
] as const;

export async function prepareDependencies(options: {
  readonly repository: string;
  readonly directory: string;
}): Promise<void> {
  const manifest = Bun.file(path.join(options.directory, "package.json"));
  if (!(await manifest.exists())) {
    return;
  }

  const sourceNodeModules = path.join(options.repository, "node_modules");
  if (!existsSync(sourceNodeModules)) {
    return;
  }

  let matchedLockfile = false;
  for (const lockfileName of supportedLockfiles) {
    const historicalFile = Bun.file(path.join(options.directory, lockfileName));
    if (!(await historicalFile.exists())) {
      continue;
    }

    const currentFile = Bun.file(path.join(options.repository, lockfileName));
    if (!(await currentFile.exists())) {
      throw new Error("Dependency lock unavailable");
    }

    if (historicalFile.size > 8 * 1024 * 1024 || currentFile.size > 8 * 1024 * 1024) {
      throw new Error("Dependency lock exceeds the size limit");
    }
    const beforeBuffer = await historicalFile.arrayBuffer();
    const afterBuffer = await currentFile.arrayBuffer();
    if (Bun.hash(beforeBuffer) !== Bun.hash(afterBuffer)) {
      throw new Error(
        "Historical dependencies differ from installed dependencies",
      );
    }

    matchedLockfile = true;
  }

  if (!matchedLockfile) {
    throw new Error(
      "Cannot establish historical dependency versions without a lockfile",
    );
  }

  const sourceStats = await lstat(sourceNodeModules);
  if (!sourceStats.isDirectory() || sourceStats.isSymbolicLink()) {
    throw new Error("Dependency root must be a regular directory");
  }
  const repositoryRoot = await realpath(options.repository);
  const destinationNodeModules = path.join(options.directory, "node_modules");
  await cp(sourceNodeModules, destinationNodeModules, {
    recursive: true,
    verbatimSymlinks: true,
  });

  const glob = new Bun.Glob("**/*");
  for await (const relativePath of glob.scan({
    cwd: destinationNodeModules,
    dot: true,
    onlyFiles: false,
    followSymlinks: false,
  })) {
    const targetPath = path.join(destinationNodeModules, relativePath);
    const stat = await lstat(targetPath);
    if (!stat.isSymbolicLink()) {
      continue;
    }

    const originalLink = path.join(sourceNodeModules, relativePath);
    const originalTarget = await realpath(originalLink);

    if (!originalTarget.startsWith(`${repositoryRoot}${path.sep}`)) {
      throw new Error(
        "Dependency links outside the repository cannot be replayed",
      );
    }

    const mappedTarget = path.join(
      options.directory,
      path.relative(repositoryRoot, originalTarget),
    );

    const mappedResolved = await realpath(mappedTarget).catch(() => null);
    if (mappedResolved !== null && !mappedResolved.startsWith(`${options.directory}${path.sep}`)) {
      throw new Error("Dependency target escapes the snapshot");
    }
    await rm(targetPath);

    await symlink(
      path.relative(path.dirname(targetPath), mappedTarget),
      targetPath,
    );
  }
}
