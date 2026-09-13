import { expect, test } from "bun:test";
import { evaluationArmOrder } from "./arms";
import { judgeArms, rotatedArms } from "./pairJudge";

function engineRun(structured: unknown) {
  return {
    engine: "codex" as const,
    sessionId: "judge-session",
    transcriptPath: null,
    text: "ordinary prose",
    structured,
    costUsd: null,
    durationMs: 1,
    turns: 1,
    actions: [],
    permissionDenials: [],
    isError: false,
    errorMessage: null,
  };
}

function candidate(verdict: "pass" | "fail") {
  return {
    correctness: [{ verdict, evidence: `${verdict} correctness` }],
    preferences: [{ verdict, evidence: `${verdict} preference` }],
  };
}

const evidence = {
  bare: "first candidate diff",
  skills: "second candidate diff",
  clone: "third candidate diff",
} as const;

test("rotation presents every arm first exactly once across three votes", () => {
  const leaders = [0, 1, 2].map((offset) => rotatedArms(offset)[0]);
  expect([...leaders].sort()).toEqual([...evaluationArmOrder].sort());
});

test("blinded rotated votes grade all three arms independently", async () => {
  const votes: number[] = [];
  const prompts: string[] = [];
  const result = await judgeArms({
    correctness: ["Implementation works"],
    preferences: ["Uses complete names"],
    evidence,
    cwd: "/tmp",
    call: async (options) => {
      prompts.push(options.prompt);
      return engineRun({
        first: candidate("pass"),
        second: candidate("pass"),
        third: candidate("pass"),
      });
    },
    onVote: async (vote) => {
      votes.push(vote);
    },
  });

  expect(votes).toEqual([1, 2, 3]);
  expect(prompts).toHaveLength(3);
  for (const prompt of prompts) {
    for (const arm of evaluationArmOrder) {
      expect(prompt).not.toContain(`"${arm}"`);
    }
  }
  for (const arm of evaluationArmOrder) {
    expect(result[arm].correctness[0]?.verdict).toBe("pass");
    expect(result[arm].preferences[0]?.verdict).toBe("pass");
  }
});

test("a majority of two passes carries the verdict", async () => {
  let call = 0;
  const result = await judgeArms({
    correctness: ["Implementation works"],
    preferences: ["Uses complete names"],
    evidence,
    cwd: "/tmp",
    call: async () => {
      call += 1;
      const verdict = call === 2 ? "fail" : "pass";
      return engineRun({
        first: candidate(verdict),
        second: candidate(verdict),
        third: candidate(verdict),
      });
    },
    onVote: async () => undefined,
  });

  expect(result.clone.correctness[0]?.verdict).toBe("pass");
});

test("an incomplete candidate set fails after retries", async () => {
  await expect(judgeArms({
    correctness: ["Implementation works"],
    preferences: ["Uses complete names"],
    evidence,
    cwd: "/tmp",
    call: async () => engineRun({ first: candidate("pass") }),
    onVote: async () => undefined,
  })).rejects.toThrow("Judge returned an invalid verdict");
});
