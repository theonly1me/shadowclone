import { lstat, readlink, realpath } from "node:fs/promises";
import path from "node:path";

function isInside(options: {
  readonly directory: string;
  readonly candidate: string;
}): boolean {
  const relative = path.relative(options.directory, options.candidate);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}

export function isSafeSnapshotLink(options: {
  readonly directory: string;
  readonly relativePath: string;
  readonly target: string;
}): boolean {
  if (path.isAbsolute(options.target)) return false;
  const absolutePath = path.join(options.directory, options.relativePath);
  const lexicalTarget = path.resolve(path.dirname(absolutePath), options.target);
  return isInside({ directory: options.directory, candidate: lexicalTarget });
}

export async function validateSnapshotLinks(directory: string): Promise<void> {
  const resolvedDirectory = await realpath(directory);
  const globScanner = new Bun.Glob("**/*").scan({
    cwd: directory,
    dot: true,
    onlyFiles: false,
    followSymlinks: false,
  });

  for await (const matchPath of globScanner) {
    const absolutePath = path.join(directory, matchPath);
    const entryStats = await lstat(absolutePath);
    if (!entryStats.isSymbolicLink()) {
      continue;
    }

    const linkTarget = await readlink(absolutePath);
    if (!isSafeSnapshotLink({ directory, relativePath: matchPath, target: linkTarget })) {
      throw new Error("Task snapshot contains an unsafe symbolic link");
    }

    let resolvedTarget: string;
    try {
      resolvedTarget = await realpath(absolutePath);
    } catch {
      throw new Error("Task snapshot contains an unsafe symbolic link");
    }

    if (!isInside({ directory: resolvedDirectory, candidate: resolvedTarget })) {
      throw new Error("Task snapshot contains an unsafe symbolic link");
    }
  }
}
