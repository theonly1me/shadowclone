import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createGitFixture } from "../collect/gitFixture";
import { parseDiff } from "../collect/diff";
import { sharedCargoTarget } from "./cache";
import { runStack } from "./stackRun";
import type { Stack } from "./types";

const files = parseDiff(
  [
    "diff --git a/src/a.ts b/src/a.ts",
    "--- a/src/a.ts",
    "+++ b/src/a.ts",
    "@@ -1 +1 @@",
    "-export const a = 1;",
    "+export const a = 2;",
    "",
  ].join("\n"),
);

const recordingStack: Stack = {
  id: "fixture",
  sources: /\.ts$/,
  detect: () => true,
  install: () => null,
  commands: [
    {
      tool: "lint",
      scope: "changed-lines",
      parser: "paren",
      command: () => ["sh", "-c", 'printf "%s" "$CARGO_TARGET_DIR" > ran.txt'],
    },
  ],
};

test("a command after the toolchain budget runs out is reported as timed out and never starts", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "shadowclone-budget-"));
  const head = { root, roots: [root] };

  const [report] = await runStack({
    stack: recordingStack,
    directory: "",
    head,
    base: async () => head,
    files,
    onProgress: () => {},
    budget: { deadline: Date.now() - 1, environment: {} },
  });

  expect([report?.status, report?.detail]).toEqual([
    "timed-out",
    "not run, because the toolchain time budget ran out",
  ]);
  expect(existsSync(path.join(root, "ran.txt"))).toBe(false);
});

test("a command gets the shared Cargo build folder in its environment", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "shadowclone-budget-"));
  const head = { root, roots: [root] };

  await runStack({
    stack: recordingStack,
    directory: "",
    head,
    base: async () => head,
    files,
    onProgress: () => {},
    budget: { deadline: Date.now() + 60_000, environment: { CARGO_TARGET_DIR: "/cache/cargo" } },
  });

  expect(readFileSync(path.join(root, "ran.txt"), "utf8")).toBe("/cache/cargo");
});

test("two clones of one repository share a Cargo build folder, and another repository gets its own", async () => {
  const first = await createGitFixture();
  await first.write({ "a.txt": "a\n" });
  first.commit("root");
  const other = await createGitFixture();
  await other.write({ "b.txt": "b\n" });
  other.commit("another root");
  const clone = await mkdtemp(path.join(os.tmpdir(), "shadowclone-clone-"));
  Bun.spawnSync({ cmd: ["git", "clone", "--quiet", first.directory, clone] });

  const [original, cloned, unrelated] = await Promise.all([
    sharedCargoTarget(first.directory),
    sharedCargoTarget(clone),
    sharedCargoTarget(other.directory),
  ]);

  expect(cloned).toBe(original);
  expect(unrelated).not.toBe(original);
});
