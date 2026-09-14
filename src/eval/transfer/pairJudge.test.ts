import { expect, test } from "bun:test";
import { evaluationArmOrder } from "./arms";
import { judgeArms } from "./pairJudge";
import { sourceRules } from "./preferenceRules";
import { batchReply, engineRun, judgeRequest } from "./judgeFixtures";

const evidence = { bare: "first candidate diff", skills: "second candidate diff", clone: "third candidate diff" };
const preferences = sourceRules({ relativePath: "skills/0/clean-code/SKILL.md", content: "Use complete names." });
const options = { taskPrompt: "Add a parser and tests.", correctness: ["Implementation works"], preferences, evidence, cwd: "/tmp", onVote: async () => undefined };

test("judges see one anonymous candidate and one scoring category at a time", async () => {
  const prompts: string[] = [];
  const result = await judgeArms({
    ...options,
    call: async (request) => {
      prompts.push(request.prompt);
      return batchReply(request);
    },
  });
  expect(prompts).toHaveLength(18);
  for (const prompt of prompts) {
    expect(Object.values(evidence).filter((candidate) => prompt.includes(candidate))).toHaveLength(1);
    const request = judgeRequest(prompt);
    expect(request.requirements).toHaveLength(1);
    expect(request.requirements[0]?.requirement).toBe(request.kind === "correctness" ? "Implementation works" : "Use complete names.");
  }
  for (const arm of evaluationArmOrder) {
    expect(result[arm].correctness[0]?.votes).toHaveLength(3);
    expect(result[arm].preferences[0]?.verdict).toBe("pass");
  }
});

test("two independent passes carry the verdict", async () => {
  const result = await judgeArms({
    ...options,
    call: async (request) => batchReply({
      prompt: request.prompt, verdict: judgeRequest(request.prompt).vote === 2 ? "fail" : "pass",
    }),
  });
  expect(result.clone.correctness[0]?.votes.map((vote) => vote.verdict)).toEqual(["pass", "fail", "pass"]);
  expect(result.clone.correctness[0]?.verdict).toBe("pass");
});

test("incomplete checks fail after bounded retries", async () => {
  let calls = 0;
  await expect(judgeArms({
    ...options, call: async () => { calls += 1; return engineRun({ checks: [] }); },
  })).rejects.toThrow("incomplete checks");
  expect(calls).toBe(9);
});

test("exact options rules and task-required signature exceptions reach the judge", async () => {
  const rules = sourceRules({
    relativePath: "skills/0/clean-code/SKILL.md",
    content: "Two or more arguments take a single options object. This applies to internal helpers too.",
  });
  const taskPrompt = "Implement parseRetryAfter(value: string, now: Date) and tests.";
  const result = await judgeArms({
    ...options, preferences: rules, taskPrompt,
    call: async (request) => {
      expect(request.prompt).toContain(taskPrompt);
      expect(request.prompt).toContain("not internal helpers");
      if (judgeRequest(request.prompt).kind === "preferences") {
        expect(request.prompt).toContain(rules[0]?.requirement ?? "");
      }
      return batchReply(request);
    },
  });
  expect(result.clone.preferences[0]?.verdict).toBe("pass");
});
