import type { EvaluationArm } from "./arms";
import { initialReceipt } from "./storage";
import { fingerprint } from "./structured";
import type { CheckResult, TransferRun } from "./types";

export const passed: CheckResult = {
  requirement: "Check",
  verdict: "pass",
  evidence: "Observed",
  votes: [],
};

export const failed: CheckResult = { ...passed, verdict: "fail" };

export function run(options: {
  readonly arm: EvaluationArm;
  readonly preference: CheckResult;
  readonly correctness?: CheckResult;
}): TransferRun {
  return {
    taskId: "private-task",
    repeat: 0,
    arm: options.arm,
    phase: "complete",
    sessionId: "private-session",
    failure: null,
    durationMs: 1,
    costUsd: null,
    dependencyState: "exact",
    observed: "private evidence",
    verification: [passed],
    safety: [passed],
    correctness: [options.correctness ?? passed],
    preferences: [options.preference],
  };
}

export function receipt() {
  const profile = "private profile";

  return initialReceipt({
    schemaVersion: 12,
    evalId: "00000000-0000-4000-8000-000000000001",
    suiteId: "00000000-0000-4000-8000-000000000002",
    repository: "/private/repository",
    baseCommit: "private-commit",
    engine: "codex",
    model: "gpt-5.6-luna",
    reasoningEffort: "medium",
    dependencyMode: "current",
    repeat: 1,
    timeoutSeconds: 600,
    maxBudgetUsd: null,
    dirtyFileCount: 2,
    context: [{ relativePath: "context.md", content: "private context" }],
    profileSnapshot: {
      kind: "current",
      fingerprint: fingerprint(profile),
      ruleCount: 12,
    },
    preflight: [passed],
    tasks: [
      {
        id: "private-task",
        startingCommit: "private-commit",
        prompt: "private prompt",
        completion: ["private completion"],
        preferences: [
          {
            requirement: "private preference",
            source: {
              relativePath: "profile.md",
              heading: "",
              line: 1,
            },
          },
        ],
        profile,
        profileFingerprint: fingerprint(profile),
      },
    ],
  });
}
