import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseDiff } from "../collect/diff";
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

test("Cargo state persists within a worktree and remains separate across review sides and runs", async () => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "shadowclone-budget-")));
  const first = path.join(root, "head");
  const second = path.join(root, "base");
  const firstState = path.join(root, "first-state");
  const secondState = path.join(root, "second-state");
  await mkdir(first);
  await mkdir(second);

  const run = async (options: { readonly workspace: string; readonly stateDirectory: string }) => {
    const head = { root: options.workspace, roots: [options.workspace] };
    const [report] = await runStack({
      stack: recordingStack,
      directory: "",
      head,
      base: async () => head,
      files,
      onProgress: () => {},
      budget: {
        deadline: Date.now() + 20_000,
        environment: { CARGO_TARGET_DIR: "/cache/cargo" },
        stateDirectory: options.stateDirectory,
      },
    });
    expect(report?.status).toBe("ran");
    return readFileSync(path.join(options.workspace, "ran.txt"), "utf8");
  };

  try {
    const initial = await run({ workspace: first, stateDirectory: firstState });
    expect(initial.startsWith(`${firstState}${path.sep}`)).toBe(true);
    expect(await run({ workspace: first, stateDirectory: firstState })).toBe(initial);
    expect(await run({ workspace: second, stateDirectory: firstState })).not.toBe(initial);
    expect(await run({ workspace: first, stateDirectory: secondState })).not.toBe(initial);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
