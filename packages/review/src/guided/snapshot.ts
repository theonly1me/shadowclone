import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { hostEnvironment, runHostCommand, runProcess } from "@shadowclone/core";
import { addWorktree, removeWorktree } from "../worktree";
import { currentAnchorFiles, type AnchorFile } from "./anchors";

export async function assertGuidedCheckout(options: {
  readonly checkout: string;
  readonly repository: string;
}): Promise<void> {
  const result = await runHostCommand({
    arguments: ["git", "remote", "get-url", "origin"],
    cwd: options.checkout,
  });
  const remote = result.stdout.trim().replace(/\.git$/, "");
  const repository = remote
    .replace(/^git@github\.com:/, "")
    .replace(/^https:\/\/github\.com\//, "");
  if (result.exitCode !== 0 || repository.toLowerCase() !== options.repository.toLowerCase())
    throw new Error(
      "The checkout does not match this PR. Open the report with --checkout pointing to its repository.",
    );
}

async function fetchMissingObjects(options: {
  readonly checkout: string;
  readonly headSha: string;
  readonly baseSha: string;
}): Promise<void> {
  const existing = await Promise.all(
    [options.headSha, options.baseSha].map((sha) =>
      runHostCommand({
        arguments: ["git", "--no-replace-objects", "cat-file", "-e", sha + "^{commit}"],
        cwd: options.checkout,
      }),
    ),
  );
  if (existing.every((result) => result.exitCode === 0)) return;
  const fetched = await runProcess({
    arguments: [
      "git",
      "-c",
      "core.hooksPath=/dev/null",
      "-c",
      "core.fsmonitor=false",
      "-c",
      "credential.helper=",
      "-c",
      "credential.https://github.com.helper=!gh auth git-credential",
      "fetch",
      "--no-tags",
      "origin",
      options.headSha,
      options.baseSha,
    ],
    cwd: options.checkout,
    environment: hostEnvironment({ remote: true }),
    timeoutMilliseconds: 120_000,
  });
  if (fetched.exitCode !== 0)
    throw new Error(
      "The current PR commits could not be fetched. Fetch the current head and base, then retry your saved notes.",
    );
}

export async function withGuidedSnapshot<Result>(options: {
  readonly checkout: string;
  readonly repository: string;
  readonly headSha: string;
  readonly baseSha: string;
  readonly use: (snapshot: {
    readonly checkout: string;
    readonly files: readonly AnchorFile[];
  }) => Promise<Result>;
}): Promise<Result> {
  await assertGuidedCheckout(options);
  await fetchMissingObjects(options);
  const files = await currentAnchorFiles(options);
  const directory = await mkdtemp(path.join(os.tmpdir(), "shadowclone-guided-source-"));
  const snapshot = path.join(directory, "head");
  let created = false;
  try {
    const worktree = await addWorktree({
      repository: options.checkout,
      sha: options.headSha,
      directory: snapshot,
    });
    created = true;
    return await options.use({ checkout: worktree.root, files });
  } finally {
    if (created) await removeWorktree({ repository: options.checkout, directory: snapshot });
    await rm(directory, { recursive: true, force: true });
  }
}
