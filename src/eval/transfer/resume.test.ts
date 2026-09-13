import { expect, test } from "bun:test";
import { readReceipt, validateResumeOptions } from "./resume";
import { initialReceipt } from "./storage";
import { fingerprint } from "./structured";

function receipt() {
  const profile = "profile";
  return initialReceipt({
    schemaVersion: 9,
    evalId: "00000000-0000-4000-8000-000000000001",
    suiteId: "00000000-0000-4000-8000-000000000002",
    repository: "/repository",
    baseCommit: "commit",
    engine: "codex",
    model: "gpt-5.6-luna",
    reasoningEffort: "medium",
    dependencyMode: "current",
    repeat: 2,
    timeoutSeconds: 600,
    context: [],
    maxBudgetUsd: null,
    dirtyFileCount: 0,
    profileSnapshot: {
      kind: "current",
      fingerprint: fingerprint(profile),
      ruleCount: 1,
    },
    preflight: [{ requirement: "test", verdict: "pass", evidence: "ok" }],
    tasks: [{
      id: "task",
      startingCommit: "commit",
      prompt: "Implement a parser",
      completion: ["Parser works"],
      preferences: [{ requirement: "Use clear names" }],
      profile,
      profileFingerprint: fingerprint(profile),
    }],
  });
}

test("reads schema 8 receipts as resumable", () => {
  const parsed = readReceipt(JSON.stringify(receipt()));
  expect(parsed.status).toBe("running");
  expect(parsed.prepared.reasoningEffort).toBe("medium");
});

test("rejects altered frozen settings and older receipts", () => {
  const original = receipt();
  const modified = {
    ...original,
    prepared: { ...original.prepared, reasoningEffort: "high" as const },
  };
  expect(() => readReceipt(JSON.stringify(modified))).toThrow("modified");
  expect(() => readReceipt(JSON.stringify({
    ...original,
    schemaVersion: 7,
  }))).toThrow("Unsupported");
});

test("resumes only against the original repository, HEAD, and settings", () => {
  const saved = receipt();
  expect(() => validateResumeOptions({
    receipt: saved,
    requested: {},
    repository: "/repository",
    commit: "commit",
  })).not.toThrow();
  for (const requested of [
    { model: "different" },
    { repeat: 3 },
    { tasks: 2 },
    { task: "New task" },
    { suiteId: "00000000-0000-4000-8000-000000000003" },
  ]) {
    expect(() => validateResumeOptions({
      receipt: saved,
      requested,
      repository: "/repository",
      commit: "commit",
    })).toThrow();
  }
  expect(() => validateResumeOptions({
    receipt: saved,
    requested: {},
    repository: "/repository",
    commit: "different",
  })).toThrow("original repository HEAD");
});
