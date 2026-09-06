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

export async function observeRun(options: {
  readonly directory: string;
  readonly run: EngineRun;
  readonly initialCommit: string;
}): Promise<string> {
  const changed = await command({
    cwd: options.directory,
    arguments: ["git", "diff", "--name-only", options.initialCommit],
  });

  const untracked = await command({
    cwd: options.directory,
    arguments: ["git", "ls-files", "--others", "--exclude-standard"],
  });

  const files: { path: string; content: string }[] = [];
  let remainingBytes = maximumFileBytes;
  let isTruncated = false;

  const paths = new Set(
    [...changed.split("\n"), ...untracked.split("\n")].filter(Boolean),
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

  return redactSecrets({
    text: JSON.stringify({
      files,
      changedPaths: changed.split("\n"),
      truncated: isTruncated,
      actions: options.run.actions,
      agentResponse: options.run.text,
      note: "Agent response is a claim, not independent proof. Files are final content, not a reference solution. Missing success metadata does not establish execution success.",
    }),
  });
}
