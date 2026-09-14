import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { command } from "./command";
import { executeTransferRuns } from "./executeRuns";
import { receiptSchema } from "./receiptSchema";
import { readReceipt } from "./resume";
import { disposeSnapshotTemplates } from "./snapshot";
import { initialReceipt } from "./storage";
import { fingerprint, parseJson } from "./structured";
import type { PreparedEval } from "./types";

test("a failed arm leaves every completed run in a resumable receipt", async () => {
  const repository = await mkdtemp(path.join(os.tmpdir(), "shadowclone-failed-repo-"));
  const directory = await mkdtemp(path.join(os.tmpdir(), "shadowclone-failed-eval-"));
  const controlDirectory = await mkdtemp(path.join(os.tmpdir(), "shadowclone-failed-control-"));
  try {
    await Bun.write(path.join(repository, "tracked.txt"), "original");
    await command({ arguments: ["git", "init", "--quiet"], cwd: repository });
    await command({ arguments: ["git", "add", "--all"], cwd: repository });
    await command({
      arguments: [
        "git",
        "-c",
        "user.name=Fixture",
        "-c",
        "user.email=fixture@localhost",
        "-c",
        "commit.gpgsign=false",
        "commit",
        "--quiet",
        "-m",
        "fixture",
      ],
      cwd: repository,
    });
    const commit = await command({
      arguments: ["git", "rev-parse", "HEAD"],
      cwd: repository,
    });
    const profile = "Use complete names.";
    const prepared: PreparedEval = {
      schemaVersion: 12,
      evalId: "00000000-0000-4000-8000-000000000001",
      suiteId: "00000000-0000-4000-8000-000000000002",
      repository,
      baseCommit: commit,
      context: [],
      profileSnapshot: {
        kind: "current",
        fingerprint: fingerprint(profile),
        ruleCount: 1,
      },
      tasks: [{
        id: "task",
        startingCommit: commit,
        prompt: "Write a parser.",
        completion: ["The parser works"],
        preferences: [{ requirement: "Use complete names", source: {
          relativePath: "profile.md", heading: "", line: 1,
        } }],
        profile,
        profileFingerprint: fingerprint(profile),
      }],
      engine: "codex",
      model: "gpt-5.6-luna",
      reasoningEffort: "medium",
      dependencyMode: "current",
      repeat: 1,
      timeoutSeconds: 60,
      maxBudgetUsd: null,
      dirtyFileCount: 0,
      preflight: [{ requirement: "Snapshot", verdict: "pass", evidence: "ok", votes: [] }],
    };
    const calls: string[] = [];
    await expect(executeTransferRuns({
      receipt: initialReceipt(prepared),
      directory,
      controlDirectory,
      json: true,
      startedAt: Date.now(),
      call: async (options) => {
        calls.push(options.prompt);
        if (options.prompt.includes(profile)) {
          throw new Error("Coding process failed");
        }
        await Bun.write(path.join(options.cwd, "parser.ts"), "export const parse = () => 1;\n");
        return {
          engine: "codex",
          sessionId: "skills",
          transcriptPath: null,
          text: "done",
          structured: null,
          costUsd: null,
          durationMs: 1,
          turns: 1,
          actions: [],
          permissionDenials: [],
          isError: false,
          errorMessage: null,
        };
      },
    })).rejects.toThrow("Resume with --eval-id");
    expect(calls).toHaveLength(3);
    const saved = readReceipt(await Bun.file(path.join(directory, "state.json")).text());
    expect(saved.status).toBe("error");
    expect(saved.progress?.stage).toBe("error");
    const persisted = receiptSchema.parse(parseJson(await Bun.file(path.join(
      directory,
      "state.json",
    )).text()));
    expect(persisted.status).toBe("error");
    expect(saved.runs).toHaveLength(3);
    expect(saved.runs.find((run) => run.arm === "skills")?.failure).toBeNull();
    expect(saved.runs.find((run) => run.arm === "clone")?.failure)
      .toContain("Coding process failed");
  } finally {
    await disposeSnapshotTemplates();
    await rm(repository, { recursive: true, force: true });
    await rm(directory, { recursive: true, force: true });
    await rm(controlDirectory, { recursive: true, force: true });
  }
});
