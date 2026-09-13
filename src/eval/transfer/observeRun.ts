import { lstat } from "node:fs/promises";
import path from "node:path";
import type { EngineRun } from "../../engine";
import { redactSecrets } from "../../redact";
import { command } from "./command";

const ignoredTopLevelDirectories = new Set([
  "node_modules",
  ".eval-context",
  ".git",
]);

const maximumFileBytes = 100000;
const maximumDiffCharacters = 100000;

export type ObservedRun = {
  readonly evidence: string;
  readonly repositoryChanged: boolean;
  readonly truncated: boolean;
};

export async function observeRun(options: {
  readonly directory: string;
  readonly run: EngineRun;
  readonly initialCommit: string;
}): Promise<ObservedRun> {
  const changed = await command({
    cwd: options.directory,
    arguments: ["git", "diff", "--name-only", options.initialCommit],
  });

  const untracked = await command({
    cwd: options.directory,
    arguments: ["git", "ls-files", "--others", "--exclude-standard"],
  });
  const fullDiff = await command({
    cwd: options.directory,
    arguments: [
      "git",
      "diff",
      "--no-ext-diff",
      "--unified=3",
      options.initialCommit,
      "--",
    ],
  });
  const diff = fullDiff.slice(0, maximumDiffCharacters);

  const files: { path: string; content: string }[] = [];
  let remainingBytes = maximumFileBytes;
  let isTruncated = diff.length < fullDiff.length;

  const paths = new Set(
    [...changed.split("\n"), ...untracked.split("\n")].filter((entry) => {
      const [topLevelDirectory] = entry.split("/");
      return Boolean(entry) &&
        (!topLevelDirectory || !ignoredTopLevelDirectories.has(topLevelDirectory));
    }),
  );

  for (const relativePath of paths) {
    const [topLevelDirectory] = relativePath.split("/");
    if (topLevelDirectory && ignoredTopLevelDirectories.has(topLevelDirectory)) {
      continue;
    }

    const absolutePath = path.resolve(options.directory, relativePath);
    if (!absolutePath.startsWith(`${options.directory}${path.sep}`)) {
      continue;
    }

    const file = Bun.file(absolutePath);
    if (!(await file.exists())) {
      continue;
    }

    const stats = await lstat(absolutePath);
    if (!stats.isFile()) {
      continue;
    }

    if (file.size > remainingBytes) {
      isTruncated = true;
      continue;
    }

    remainingBytes -= file.size;
    files.push({ path: relativePath, content: await file.text() });
  }

  return {
    evidence: JSON.stringify({
      files: files.map((file) => ({
        path: redactSecrets({ text: file.path }),
        content: redactSecrets({ text: file.content }),
      })),
      diff: redactSecrets({ text: diff }),
      changedPaths: [...paths].map((entry) => redactSecrets({ text: entry })),
      repositoryChanged: paths.size > 0,
      truncated: isTruncated,
      actions: JSON.parse(
        redactSecrets({ text: JSON.stringify(options.run.actions) }),
      ),
    }),
    repositoryChanged: paths.size > 0,
    truncated: isTruncated,
  };
}
