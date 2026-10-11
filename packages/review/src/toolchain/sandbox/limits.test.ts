import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runTool } from "../process";

test("a sandboxed process still obeys the command deadline", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "shadowclone-timeout-"));
  try {
    expect(
      await runTool({
        arguments: ["sh", "-c", "sleep 20"],
        cwd,
        environment: {},
        timeoutMilliseconds: 500,
      }),
    ).toEqual({ kind: "timed-out" });
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("a sandboxed process still obeys the output limit", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "shadowclone-output-"));
  try {
    expect(
      await runTool({
        arguments: ["bun", "-e", "process.stdout.write('x'.repeat(17 * 1024 * 1024))"],
        cwd,
        environment: {},
        timeoutMilliseconds: 10_000,
      }),
    ).toEqual({ kind: "too-much-output" });
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
