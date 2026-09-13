import { expect, test } from "bun:test";
import { evaluationArmOrder } from "./arms";
import { judgeArms } from "./pairJudge";

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

test("each judge call receives one anonymous arm's evidence", async () => {
  const votes: number[] = [];
  const prompts: string[] = [];
  const result = await judgeArms({
    correctness: ["Implementation works"],
    preferences: ["Uses complete names"],
    evidence,
    cwd: "/tmp",
    call: async (options) => {
      prompts.push(options.prompt);
      return engineRun(candidate("pass"));
    },
    onVote: async (vote) => {
      votes.push(vote);
    },
  });

  expect(votes).toEqual([1, 2, 3]);
  expect(prompts).toHaveLength(evaluationArmOrder.length * 3);
  for (const prompt of prompts) {
    const includedEvidence = Object.values(evidence).filter((candidateEvidence) =>
      prompt.includes(candidateEvidence),
    );
    expect(includedEvidence).toHaveLength(1);
  }
  for (const candidateEvidence of Object.values(evidence)) {
    expect(prompts.filter((prompt) => prompt.includes(candidateEvidence)))
      .toHaveLength(3);
  }
  for (const arm of evaluationArmOrder) {
    expect(result[arm].correctness[0]?.verdict).toBe("pass");
    expect(result[arm].preferences[0]?.verdict).toBe("pass");
  }
});

test("a majority of two passes carries the verdict", async () => {
  let callCount = 0;
  const result = await judgeArms({
    correctness: ["Implementation works"],
    preferences: ["Uses complete names"],
    evidence,
    cwd: "/tmp",
    call: async () => {
      callCount += 1;
      const vote = Math.ceil(callCount / evaluationArmOrder.length);
      return engineRun(candidate(vote === 2 ? "fail" : "pass"));
    },
    onVote: async () => undefined,
  });

  expect(result.clone.correctness[0]?.verdict).toBe("pass");
});

test("incomplete checks fail after retries", async () => {
  await expect(judgeArms({
    correctness: ["Implementation works"],
    preferences: ["Uses complete names"],
    evidence,
    cwd: "/tmp",
    call: async () => engineRun({ correctness: [], preferences: [] }),
    onVote: async () => undefined,
  })).rejects.toThrow("Judge returned incomplete checks");
});
