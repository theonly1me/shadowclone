import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "bun:test";
import { verifyGuidanceCode } from "./verify";

test("focused verification never treats absent tests or escaped paths as a pass", async () => {
  expect(
    await verifyGuidanceCode({ directory: "/tmp/eval-fixture", files: [] }),
  ).toMatchObject({ verdict: "not-verified" });
  expect(
    await verifyGuidanceCode({
      directory: "/tmp/eval-fixture",
      files: [{ path: "../escape.test.ts", content: "" }],
    }),
  ).toMatchObject({ verdict: "fail" });
});

test("focused verification rejects a test path that resolves outside the snapshot", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "guidance-verifier-"));
  const outside = await mkdtemp(path.join(os.tmpdir(), "guidance-outside-"));

  try {
    await writeFile(
      path.join(outside, "escaped.test.ts"),
      'import { test } from "bun:test"; test("pass", () => {});',
    );
    await symlink(outside, path.join(directory, "linked"), "dir");

    const result = await verifyGuidanceCode({
      directory,
      files: [{ path: "linked/escaped.test.ts", content: "" }],
    });

    expect(result).toEqual({
      verdict: "fail",
      evidence: "A changed test resolves outside the snapshot.",
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});

test("focused verification rejects a linked runtime directory", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "guidance-verifier-"));
  const outside = await mkdtemp(path.join(os.tmpdir(), "guidance-outside-"));

  try {
    await writeFile(
      path.join(directory, "focused.test.ts"),
      'import { test } from "bun:test"; test("pass", () => {});',
    );
    await symlink(outside, path.join(directory, ".eval-verification"), "dir");

    const result = await verifyGuidanceCode({
      directory,
      files: [{ path: "focused.test.ts", content: "" }],
    });

    expect(result).toEqual({
      verdict: "fail",
      evidence: "The focused test runtime is linked or not a directory.",
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});
