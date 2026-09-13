import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { modelCaller } from "./call";
import { command } from "./command";
import { withEvaluationDeadline } from "./deadline";
import { executeTransferRuns } from "./executeRuns";
import { receiptSchema } from "./receiptSchema";
import { initialReceipt } from "./storage";
import { fingerprint, parseJson } from "./structured";
import type { PreparedEval } from "./types";

test("the overall deadline aborts an in-flight model call", async () => {
  let aborted = false;
  const call = modelCaller({
    engine: "codex",
    model: "gpt-5.6-luna",
    timeoutSeconds: 60,
    runner: async (options) => {
      await new Promise<void>((resolve, reject) => {
        const fallback = setTimeout(resolve, 100);
        options.signal?.addEventListener("abort", () => {
          clearTimeout(fallback);
          aborted = true;
          reject(new Error("Model process stopped"));
        }, { once: true });
      });
      throw new Error("Model process returned unexpectedly");
    },
  });
  const startedAt = Date.now();
  await expect(withEvaluationDeadline({
    enabled: true,
    durationMs: 20,
    operation: async () => call({ cwd: os.tmpdir(), prompt: "test" }),
  })).rejects.toThrow("wall-clock limit");
  expect(aborted).toBeTrue();
  expect(Date.now() - startedAt).toBeLessThan(1_000);
});

test("the overall deadline aborts an in-flight evaluation command", async () => {
  const startedAt = Date.now();
  await expect(withEvaluationDeadline({
    enabled: true,
    durationMs: 20,
    operation: async () => command({
      arguments: ["sleep", "10"],
      cwd: os.tmpdir(),
    }),
  })).rejects.toThrow("wall-clock limit");
  expect(Date.now() - startedAt).toBeLessThan(1_000);
});

test("the wall-clock limit exits even when an operation ignores cancellation", async () => {
  const startedAt = Date.now();
  await expect(withEvaluationDeadline({
    enabled: true,
    durationMs: 40,
    operation: async () => {
      await Bun.sleep(200);
      return "late";
    },
  })).rejects.toThrow("wall-clock limit");
  expect(Date.now() - startedAt).toBeLessThan(150);
});

test("an expired one-task attempt records timeout status before coding", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "shadowclone-eval-deadline-"));
  const profile = "Use complete names.";
  const prepared: PreparedEval = {
    schemaVersion: 10,
    evalId: "00000000-0000-4000-8000-000000000001",
    suiteId: "00000000-0000-4000-8000-000000000002",
    repository: directory,
    baseCommit: "commit",
    context: [],
    profileSnapshot: {
      kind: "current",
      fingerprint: fingerprint(profile),
      ruleCount: 1,
    },
    tasks: [{
      id: "task",
      startingCommit: "commit",
      prompt: "Write a parser.",
      completion: ["The parser works"],
      preferences: [{ requirement: "Use complete names" }],
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
  let calls = 0;
  try {
    await expect(withEvaluationDeadline({
      enabled: true,
      durationMs: 500,
      operation: async () => {
        await Bun.sleep(380);
        return executeTransferRuns({
          receipt: initialReceipt(prepared),
          directory,
          controlDirectory: directory,
          json: true,
          startedAt: Date.now(),
          call: async () => {
            calls += 1;
            throw new Error("Coding should not start");
          },
        });
      },
    })).rejects.toThrow("wall-clock limit");
    const saved = receiptSchema.parse(parseJson(await Bun.file(path.join(
      directory,
      "receipt.json",
    )).text()));
    expect(saved.status).toBe("error");
    expect(saved.progress?.stage).toBe("timeout");
    expect(calls).toBe(0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
