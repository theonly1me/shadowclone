import { expect, test } from "bun:test";
import { progressDescription, progressLine, stepLine } from "./progress";
import type { EvaluationProgress } from "./types";

const judging: EvaluationProgress = {
  stage: "judging",
  taskIndex: 2,
  taskCount: 3,
  repeatIndex: 1,
  repeatCount: 2,
  arm: null,
  voteIndex: 2,
  voteCount: 3,
  updatedAt: "2026-09-13T00:00:00.000Z",
};

test("shows elapsed task, repeat, arm, stage, and judge progress", () => {
  expect(progressLine({
    progress: { ...judging, stage: "coding", arm: "clone", voteIndex: null },
    startedAt: 1_000,
    now: 126_000,
  })).toBe("[02:05] Task 2/3, repeat 1/2, clone: coding");
  expect(progressDescription(judging)).toBe(
    "Task 2/3, repeat 1/2: blind judge vote 2/3",
  );
  expect(stepLine({
    message: "Preparing 3 fresh additive coding tasks",
    startedAt: 1_000,
    now: 6_000,
  })).toBe("[00:05] Preparing 3 fresh additive coding tasks");
});
