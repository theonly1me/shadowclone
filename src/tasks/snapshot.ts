import path from "node:path";
import { lstat, readlink } from "node:fs/promises";
import { fingerprint } from "../localFiles";
import { taskCommand, type TaskContext } from "./context";
import { canonicalPath } from "../paths";
import type { WorkspaceSnapshot } from "./schema";

export async function snapshotWorkspace(
  options: TaskContext,
): Promise<WorkspaceSnapshot> {
  const [head, branch, listed, index, status] = await Promise.all([
    taskCommand({ ...options, command: ["git", "rev-parse", "HEAD"] }),
    taskCommand({ ...options, command: ["git", "branch", "--show-current"] }),
    taskCommand({
      ...options,
      command: [
        "git",
        "ls-files",
        "-z",
        "--cached",
        "--others",
        "--exclude-standard",
      ],
    }),
    taskCommand({ ...options, command: ["git", "ls-files", "--stage", "-z"] }),
    taskCommand({
      ...options,
      command: [
        "git",
        "status",
        "--porcelain=v1",
        "-z",
        "--untracked-files=all",
      ],
    }),
  ]);
  const names = [...new Set(listed.split("\0").filter(Boolean))].sort();
  if (names.length > 20_000)
    throw new Error("Task snapshot exceeds the file budget");
  const files: Record<string, string> = {};
  let bytes = 0;
  for (const name of names) {
    const target = path.resolve(options.cwd, name);
    if (!target.startsWith(`${path.resolve(options.cwd)}${path.sep}`))
      throw new Error("Task snapshot encountered an invalid path");
    const metadata = await lstat(target).catch(() => null);
    if (metadata === null) {
      files[name] = fingerprint("deleted");
      continue;
    }
    if (metadata.isSymbolicLink()) {
      files[name] = fingerprint(`link:${await readlink(target)}`);
      continue;
    }
    if (
      !canonicalPath(target).startsWith(
        `${canonicalPath(options.cwd)}${path.sep}`,
      )
    )
      throw new Error(
        "Task snapshot cannot follow a directory outside the worktree",
      );
    if (!metadata.isFile())
      throw new Error(
        "Task snapshots require regular files; submodules need separate tasks",
      );
    bytes += metadata.size;
    if (metadata.size > 8_000_000 || bytes > 64_000_000)
      throw new Error("Task snapshot exceeds the byte budget");
    const content = await Bun.file(target).arrayBuffer();
    files[name] = new Bun.CryptoHasher("sha256")
      .update(String(metadata.mode & 0o777))
      .update(content)
      .digest("hex");
  }
  const contentFingerprint = fingerprint(JSON.stringify(files));
  return {
    head: head.trim(),
    branch: branch.trim(),
    contentFingerprint,
    files,
    dirty: status.length > 0,
    fingerprint: fingerprint(
      JSON.stringify([
        head.trim(),
        branch.trim(),
        contentFingerprint,
        index,
        status,
      ]),
    ),
  };
}

export function outsideTaskScope(options: {
  readonly baseline: WorkspaceSnapshot;
  readonly current: WorkspaceSnapshot;
  readonly scopes: readonly string[];
}): readonly string[] {
  const names = new Set([
    ...Object.keys(options.baseline.files),
    ...Object.keys(options.current.files),
  ]);
  return [...names].filter(
    (name) =>
      options.baseline.files[name] !== options.current.files[name] &&
      !options.scopes.some(
        (scope) =>
          scope === "." || name === scope || name.startsWith(`${scope}/`),
      ),
  );
}
