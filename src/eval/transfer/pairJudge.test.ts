import { expect, test } from "bun:test";
import { evaluationArmOrder } from "./arms";
import { judgeArms } from "./pairJudge";
import { sourceRules } from "./preferenceRules";

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

const preferences = sourceRules({
  relativePath: "skills/0/clean-code/SKILL.md",
  content: "Uses complete names",
});

test("each judge call receives one anonymous arm's evidence", async () => {
  const votes: number[] = [];
  const prompts: string[] = [];
  const result = await judgeArms({
    taskPrompt: "Add a parser and tests.",
    correctness: ["Implementation works"],
    preferences,
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
    taskPrompt: "Add a parser and tests.",
    correctness: ["Implementation works"],
    preferences,
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
  expect(result.clone.correctness[0]?.votes).toEqual([
    { verdict: "pass", evidence: "pass correctness" },
    { verdict: "fail", evidence: "fail correctness" },
    { verdict: "pass", evidence: "pass correctness" },
  ]);
});

test("incomplete checks fail after retries", async () => {
  await expect(judgeArms({
    taskPrompt: "Add a parser and tests.",
    correctness: ["Implementation works"],
    preferences,
    evidence,
    cwd: "/tmp",
    call: async () => engineRun({ correctness: [], preferences: [] }),
    onVote: async () => undefined,
  })).rejects.toThrow("Judge returned incomplete checks");
});

test("judges receive exact sourced rules and can abstain only on preferences", async () => {
  const taskPrompt = "Implement parseRetryAfter(value: string, now: Date) and tests.";
  const rules = sourceRules({
    relativePath: "skills/0/clean-code/SKILL.md",
    content: "# TypeScript\n- Two or more arguments take a single options object. This applies to internal helpers too.",
  });
  const result = await judgeArms({
    taskPrompt,
    correctness: ["Parses the header"],
    preferences: rules,
    evidence,
    cwd: "/tmp",
    call: async (options) => {
      expect(options.prompt).toContain(JSON.stringify(rules));
      expect(options.prompt).toContain(taskPrompt);
      expect(options.prompt).toContain("not internal helpers");
      return engineRun({
        correctness: [{ verdict: "fail", evidence: "Header parsing is missing" }],
        preferences: [{ verdict: "not-applicable", evidence: "Only the task-required API has two inputs; there are no helpers" }],
      });
    },
    onVote: async () => undefined,
  });
  expect(result.clone.correctness[0]?.verdict).toBe("fail");
  expect(result.clone.preferences[0]?.verdict).toBe("not-applicable");
  expect(result.clone.preferences[0]?.votes).toHaveLength(3);
});
