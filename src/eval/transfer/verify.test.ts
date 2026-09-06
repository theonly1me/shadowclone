import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { canonicalPath } from "../../paths";
import { verificationArguments } from "./verify";

async function snapshotDirectory(): Promise<string> {
  return await mkdtemp(path.join(os.tmpdir(), "shadowclone-verify-"));
}

test("allows writes to the resolved snapshot path in the macOS sandbox profile", async () => {
  const directory = await snapshotDirectory();

  try {
    const command = verificationArguments({
      directory,
      arguments: ["bun", "run", "test"],
      platform: "darwin",
    });

    const profile = command[2] ?? "";
    expect(profile).toContain(
      `(allow file-write* (subpath ${JSON.stringify(canonicalPath(directory))})`,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("binds the snapshot after the tmpfs so the mount is not shadowed on Linux", async () => {
  const directory = await snapshotDirectory();

  try {
    const command = verificationArguments({
      directory,
      arguments: ["bun", "run", "test"],
      platform: "linux",
    });

    const tmpfsIndex = command.indexOf("--tmpfs");
    const bindIndex = command.indexOf("--bind");

    expect(tmpfsIndex).toBeGreaterThan(-1);
    expect(bindIndex).toBeGreaterThan(tmpfsIndex);
    expect(command[bindIndex + 1]).toBe(canonicalPath(directory));
    expect(command[command.indexOf("--chdir") + 1]).toBe(
      canonicalPath(directory),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("refuses to verify on a platform without a sandbox", () => {
  expect(() =>
    verificationArguments({
      directory: "/tmp/snapshot",
      arguments: ["bun", "run", "test"],
      platform: "win32",
    }),
  ).toThrow("sandbox-exec or Linux bubblewrap");
});
