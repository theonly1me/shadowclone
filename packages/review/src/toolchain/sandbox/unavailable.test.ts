import { expect, spyOn, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { SandboxManager } from "@anthropic-ai/sandbox-runtime";
import { runStack } from "../stackRun";
import type { Stack } from "../types";

test("an unavailable sandbox fails the check and never starts the PR command", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "shadowclone-unavailable-"));
  const initialize = spyOn(SandboxManager, "initialize").mockRejectedValueOnce(
    new Error("synthetic sandbox failure"),
  );
  const stack: Stack = {
    id: "fixture",
    sources: /\.ts$/,
    detect: () => true,
    install: () => null,
    commands: [
      {
        tool: "typecheck",
        scope: "changed-lines",
        parser: "paren",
        command: () => ["sh", "-c", "touch ran.txt"],
      },
    ],
  };
  const head = { root, roots: [root] };

  try {
    const [report] = await runStack({
      stack,
      directory: "",
      head,
      base: async () => head,
      files: [],
      onProgress: () => {},
      budget: { deadline: Date.now() + 10_000, environment: {} },
    });
    expect(report?.status).toBe("failed");
    expect(report?.detail).toContain("sandbox unavailable: synthetic sandbox failure");
    expect(existsSync(path.join(root, "ran.txt"))).toBe(false);
  } finally {
    initialize.mockRestore();
    await rm(root, { recursive: true, force: true });
  }
});
