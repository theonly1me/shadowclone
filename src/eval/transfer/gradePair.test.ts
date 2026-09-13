import { expect, test } from "bun:test";
import { evaluationArmOrder, type EvaluationArm } from "./arms";
import { gradeArms } from "./gradePair";
import { fingerprint } from "./structured";
import type { CheckResult, DelegationTask, TransferRun } from "./types";

const passed: CheckResult = {
  requirement: "Reviewable code",
  verdict: "pass",
  evidence: "Observed",
};
const profile = "Use complete names.";
const task: DelegationTask = {
  id: "task",
  startingCommit: "commit",
  prompt: "Add a new parser utility and tests.",
  completion: ["The parser works"],
  preferences: [{ requirement: "Use complete names" }],
  profile,
  profileFingerprint: fingerprint(profile),
};

function evidence(arm: EvaluationArm): TransferRun {
  return {
    taskId: task.id,
    repeat: 0,
    arm,
    phase: "evidence",
    sessionId: `${arm}-session`,
    failure: null,
    durationMs: 10,
    costUsd: null,
    dependencyState: "not-required",
    observed: `{"candidate":"${arm}"}`,
    verification: [passed],
    safety: [passed],
    correctness: [],
    preferences: [],
  };
}

test("grades every arm from one blinded judging pass", async () => {
  const runs = evaluationArmOrder.map(evidence);
  let calls = 0;

  const graded = await gradeArms({
    runs,
    task,
    directory: "/tmp",
    call: async () => {
      calls += 1;
      const candidate = {
        correctness: [{ verdict: "pass" as const, evidence: "meets behavior" }],
        preferences: [{ verdict: "pass" as const, evidence: "follows guidance" }],
      };
      return {
        engine: "codex" as const,
        sessionId: "judge",
        transcriptPath: null,
        text: "",
        structured: { first: candidate, second: candidate, third: candidate },
        costUsd: null,
        durationMs: 1,
        turns: 1,
        actions: [],
        permissionDenials: [],
        isError: false,
        errorMessage: null,
      };
    },
    onVote: async () => undefined,
  });

  expect(calls).toBe(3);
  expect(graded.map((run) => run.arm)).toEqual([...evaluationArmOrder]);
  for (const run of graded) {
    expect(run.phase).toBe("complete");
    expect(run.preferences[0]?.verdict).toBe("pass");
  }
});

test("missing evidence for any arm stops grading", async () => {
  const runs = evaluationArmOrder.map(evidence).map((run) =>
    run.arm === "clone" ? { ...run, observed: null } : run
  );

  await expect(gradeArms({
    runs,
    task,
    directory: "/tmp",
    call: async () => {
      throw new Error("judge must not run");
    },
    onVote: async () => undefined,
  })).rejects.toThrow("Evaluation evidence is missing");
});
