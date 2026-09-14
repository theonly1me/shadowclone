import { expect, test } from "bun:test";
import { batchReply, engineRun, judgeRequest } from "./judgeFixtures";
import { judgeCandidate } from "./pairJudge";
import { sourceRules } from "./preferenceRules";
import type { JudgingState } from "./judgeTypes";

const preferences = sourceRules({
  relativePath: "skills/conventions.md",
  content: Array.from({ length: 17 }, (_, index) => `- Code criterion ${index + 1}`).join("\n"),
});
const options = {
  taskPrompt: "Implement a parser", correctness: ["Parses input"], preferences,
  evidence: "parser.ts", cwd: "/tmp", onVote: async () => undefined,
};

test("batches all criteria without dropping any and checkpoints every validated response", async () => {
  const checkpoints: JudgingState[] = [];
  let calls = 0;
  const result = await judgeCandidate({
    ...options, onCheckpoint: async (state) => { checkpoints.push(state); },
    call: async (request) => {
      calls += 1;
      expect(judgeRequest(request.prompt).requirements.length).toBeLessThanOrEqual(8);
      return batchReply(request);
    },
  });
  expect(calls).toBe(12);
  expect(result.preferences).toHaveLength(17);
  expect(result.preferences.every((check) => check.votes.length === 3)).toBeTrue();
  expect(checkpoints.at(-1)?.pending).toHaveLength(0);
  expect(checkpoints.at(-1)?.completed).toHaveLength(12);
  for (let count = 1; count <= 12; count += 1) {
    expect(checkpoints.some((state) => state.completed.length === count)).toBeTrue();
  }
});

test("unknown IDs are retried with feedback and never accepted as complete votes", async () => {
  let calls = 0;
  await expect(judgeCandidate({
    ...options,
    call: async (request) => {
      calls += 1;
      if (calls > 1) expect(request.prompt).toContain("unknown criterion IDs");
      return engineRun({ checks: [{ id: "unknown", verdict: "pass", evidence: "Wrong criterion" }] });
    },
  })).rejects.toThrow("unknown criterion IDs");
  expect(calls).toBe(3);
});

test("failed-call diagnostics redact secrets before checkpointing", async () => {
  let saved: JudgingState | undefined;
  const secret = `sk-${"k".repeat(40)}`;
  await expect(judgeCandidate({
    ...options,
    onCheckpoint: async (state) => { saved = state; },
    call: async () => { throw new Error(`Transport failed ${secret}`); },
  })).rejects.toThrow("Transport failed");
  expect(JSON.stringify(saved)).not.toContain(secret);
  expect(saved?.attempts).toHaveLength(3);
});
