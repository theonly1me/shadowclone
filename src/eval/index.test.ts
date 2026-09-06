import { expect, test } from "bun:test";
import {
  computeScoreDelta,
  extractBehaviorFromActions,
  extractBehaviorFromIndex,
  scoreReplay,
} from "./index";

test("scores the four replay dimensions independently", () => {
  const score = scoreReplay({
    actual: {
      tools: ["Read", "Edit", "Bash"],
      verificationSteps: ["typecheck", "test"],
      filesTouched: ["src/main.ts", "src/main.test.ts"],
      plannedBeforeEditing: true,
    },
    clone: {
      tools: ["Read", "Edit"],
      verificationSteps: ["test"],
      filesTouched: ["src/main.ts"],
      plannedBeforeEditing: false,
    },
  });

  expect(score.tools).toBeCloseTo(2 / 3);
  expect(score.verification).toBe(0.5);
  expect(score.files).toBe(0.5);
  expect(score.planning).toBe(0);
  expect(score.total).toBeCloseTo(5 / 12);
});

test("normalizes paths to posix repo-relative before comparison", () => {
  const score = scoreReplay({
    actual: {
      tools: ["Edit"],
      verificationSteps: [],
      filesTouched: ["src/main.ts"],
      plannedBeforeEditing: false,
    },
    clone: {
      tools: ["Edit"],
      verificationSteps: [],
      filesTouched: ["./src/main.ts"],
      plannedBeforeEditing: false,
    },
  });

  expect(score.files).toBe(1);
});

test("excludes dimensions from mean when both sides are empty", () => {
  const score = scoreReplay({
    actual: {
      tools: ["Read"],
      verificationSteps: [],
      filesTouched: null,
      plannedBeforeEditing: true,
    },
    clone: {
      tools: ["Read"],
      verificationSteps: [],
      filesTouched: null,
      plannedBeforeEditing: true,
    },
  });

  expect(score.tools).toBe(1);
  expect(score.verification).toBeNull();
  expect(score.files).toBeNull();
  expect(score.planning).toBe(1);
  expect(score.total).toBe(1);
});

test("computes per-dimension score deltas between clone and baseline", () => {
  const baseline = scoreReplay({
    actual: {
      tools: ["Read", "Edit"],
      verificationSteps: ["bun test"],
      filesTouched: ["src/main.ts"],
      plannedBeforeEditing: true,
    },
    clone: {
      tools: ["Read"],
      verificationSteps: [],
      filesTouched: ["src/other.ts"],
      plannedBeforeEditing: false,
    },
  });
  const clone = scoreReplay({
    actual: {
      tools: ["Read", "Edit"],
      verificationSteps: ["bun test"],
      filesTouched: ["src/main.ts"],
      plannedBeforeEditing: true,
    },
    clone: {
      tools: ["Read", "Edit"],
      verificationSteps: ["bun test"],
      filesTouched: ["src/main.ts"],
      plannedBeforeEditing: true,
    },
  });

  const delta = computeScoreDelta({ baseline, clone });
  expect(delta.tools).toBe(0.5);
  expect(delta.planning).toBe(1);
  expect(delta.total).toBeGreaterThan(0);
});

test("extracts behavior from engine actions", () => {
  const behavior = extractBehaviorFromActions({
    actions: [
      { tool: "ExitPlanMode", path: null },
      { tool: "Edit", path: "src/file.ts" },
      { tool: "Bash", path: null, command: "bun test --watch" },
    ],
  });

  expect(behavior.tools).toEqual(["ExitPlanMode", "Edit", "Bash"]);
  expect(behavior.filesTouched).toEqual(["src/file.ts"]);
  expect(behavior.verificationSteps).toEqual(["bun test"]);
  expect(behavior.plannedBeforeEditing).toBeTrue();
});

test("extracts behavior from index with filesTouched as null", () => {
  const behavior = extractBehaviorFromIndex({
    events: [
      {
        id: 1,
        sourcePath: "/path",
        source: "claude-code",
        sessionId: "s1",
        eventId: "e1",
        parentEventId: null,
        timestamp: 100,
        cwd: "/repo",
        gitBranch: "main",
        kind: "tool-call",
        tool: { name: "Edit", toolUseId: "t1" },
        isError: false,
        textRef: null,
      },
    ],
  });

  expect(behavior.tools).toEqual(["Edit"]);
  expect(behavior.filesTouched).toBeNull();
  expect(behavior.plannedBeforeEditing).toBeFalse();
});
