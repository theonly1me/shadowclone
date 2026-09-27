import { expect, test } from "bun:test";
import { candidateFixture, guidanceFixture } from "./fixtures";
import { judgeGuidance } from "./judge";
import { sourceJudgingFixture } from "./judgeAdherence.fixtures";
import {
  adherenceJudgeInstructions,
  sourceJudgePromptFingerprint,
} from "./judgePrompt";

test("version 3 keeps its original prompt while version 4 appends only the clarification", async () => {
  const scenario = guidanceFixture().scenarios.find(
    (entry) => entry.mode === "advice",
  );

  if (!scenario) {
    throw new Error("Advice fixture missing");
  }

  const prompts: string[] = [];

  for (const version of [3, 4] as const) {
    await judgeGuidance({
      scenario,
      candidate: candidateFixture(),
      vote: 1,
      cwd: "/synthetic",
      sourceJudging: sourceJudgingFixture(version),
      call: async (request) => {
        prompts.push(request.prompt);

        return {
          engine: "claude-code",
          sessionId: "synthetic",
          transcriptPath: null,
          text: "",
          costUsd: 0,
          durationMs: 0,
          turns: 1,
          isError: false,
          structured: {
            checks: [
              {
                id: "complete-names",
                verdict: "unknown",
                evidence: "Synthetic",
              },
            ],
          },
          permissionDenials: [],
          actions: [],
          errorMessage: null,
        };
      },
    });
  }

  const [historical, clarified] = prompts;

  expect(historical).not.toContain(
    "Separate source adherence from technical validity",
  );
  expect(
    clarified?.replace(`${adherenceJudgeInstructions.join("\n\n")}\n\n`, ""),
  ).toBe(historical);
});

test("a mismatched judge version and fingerprint stops before any invocation", async () => {
  const [scenario] = guidanceFixture().scenarios;

  if (!scenario) {
    throw new Error("Scenario fixture missing");
  }

  let calls = 0;

  await expect(
    judgeGuidance({
      scenario,
      candidate: candidateFixture(),
      vote: 1,
      cwd: "/synthetic",
      sourceJudging: {
        ...sourceJudgingFixture(4),
        promptFingerprint: sourceJudgePromptFingerprint(3),
      },
      call: async () => {
        calls += 1;

        throw new Error("Must not call");
      },
    }),
  ).rejects.toThrow("fingerprint");
  expect(calls).toBe(0);
});
