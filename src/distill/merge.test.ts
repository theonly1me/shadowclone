import { expect, test } from "bun:test";
import type { EngineRunner } from "../engine";
import { mergeDistilledRules } from "./merge";
import type { DistilledRule } from "./schema";

const rules: readonly DistilledRule[] = [
  {
    title: "Plans before editing",
    body: "Show the plan before changing files.",
    section: "workflow",
  },
  {
    title: "Plan first",
    body: "Present a plan before touching the code.",
    section: "workflow",
  },
];

function runnerReturning(structured: unknown): EngineRunner {
  return () =>
    Promise.resolve({
      engine: "claude-code",
      sessionId: "merge-session",
      transcriptPath: null,
      text: "",
      structured,
      costUsd: 0.01,
      durationMs: 10,
      turns: 1,
      isError: false,
      permissionDenials: [],
    });
}

test("returns the consolidated rules the engine produced", async () => {
  const merged = await mergeDistilledRules({
    rules,
    runner: runnerReturning({
      rules: [
        {
          title: "Plans before editing",
          body: "Show the plan before changing files.",
          section: "workflow",
        },
      ],
    }),
    cwd: "/tmp",
  });

  expect(merged.length).toBe(1);
});

test("keeps the unmerged rules when the engine returns an unusable shape", async () => {
  const merged = await mergeDistilledRules({
    rules,
    runner: runnerReturning({ summary: "nothing to merge" }),
    cwd: "/tmp",
  });

  expect(merged).toEqual(rules);
});
