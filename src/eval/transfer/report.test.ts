import { expect, test } from "bun:test";
import type { EvaluationArm } from "./arms";
import { evaluationStatus, reportLines, summarize } from "./report";
import { initialReceipt } from "./storage";
import { fingerprint } from "./structured";
import type { CheckResult, TransferRun } from "./types";

const passed: CheckResult = {
  requirement: "Check",
  verdict: "pass",
  evidence: "Observed",
  votes: [],
};
const failed: CheckResult = { ...passed, verdict: "fail" };

function run(options: {
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

function receipt() {
  const profile = "private profile";
  return initialReceipt({
    schemaVersion: 11,
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
    tasks: [{
      id: "private-task",
      startingCommit: "private-commit",
      prompt: "private prompt",
      completion: ["private completion"],
      preferences: [{ requirement: "private preference", source: {
        relativePath: "profile.md", heading: "", line: 1,
      } }],
      profile,
      profileFingerprint: fingerprint(profile),
    }],
  });
}

test("reports a quantified pass without exposing task content", () => {
  const prepared = receipt();
  const complete = {
    ...prepared,
    runs: [
      run({ arm: "bare", preference: failed }),
      run({ arm: "skills", preference: failed }),
      run({ arm: "clone", preference: passed }),
    ],
  };
  const status = evaluationStatus(complete);
  const finalReceipt = { ...complete, status };
  const summary = summarize(finalReceipt);
  const report = reportLines(finalReceipt).join("\n");
  expect(status).toBe("pass");
  expect(summary.profileLift).toBe(1);
  expect(summary.libraryLift).toBe(0);
  expect(summary.wins).toBe(1);
  expect(report).toContain("100.0 percentage points");
  expect(report).toContain("relative: newly achieved");
  expect(report).toContain(
    "Decision grade: no; requires at least 3 tasks x 2 repeats",
  );
  expect(report).toContain("three independent blinded votes per arm");
  for (const privateText of [
    "/private/repository",
    "private prompt",
    "private profile",
    "private context",
  ]) {
    expect(report).not.toContain(privateText);
  }
});

test("returns a useful fail for no lift or a correctness regression", () => {
  const prepared = receipt();
  const noLift = {
    ...prepared,
    runs: [
      run({ arm: "skills", preference: passed }),
      run({ arm: "clone", preference: passed }),
    ],
  };
  const regression = {
    ...prepared,
    runs: [
      run({ arm: "skills", preference: failed }),
      run({ arm: "clone", preference: passed, correctness: failed }),
    ],
  };
  expect(evaluationStatus(noLift)).toBe("fail");
  expect(evaluationStatus(regression)).toBe("fail");
});

test("not-applicable preferences earn no points and leave the denominator", () => {
  const complete = {
    ...receipt(),
    runs: [{
      ...run({ arm: "clone", preference: passed }),
      preferences: [passed, failed, {
        ...passed,
        verdict: "not-applicable" as const,
      }],
    }],
  };
  expect(summarize(complete).arms.clone.adherence).toBe(0.5);
  expect(summarize({
    ...complete,
    runs: complete.runs.map((candidate) => ({
      ...candidate,
      preferences: [{ ...passed, verdict: "not-applicable" as const }],
    })),
  }).arms.clone.adherence).toBe(0);
});
