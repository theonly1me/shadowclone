import { expect, test } from "bun:test";
import type { EngineRun } from "../../engine";
import { prepareTasks } from "./prepare";

function engineResponse(payload: unknown): EngineRun {
  return {
    engine: "codex",
    sessionId: "mock",
    transcriptPath: null,
    text: JSON.stringify(payload),
    structured: null,
    costUsd: null,
    durationMs: 10,
    turns: 1,
    actions: [],
    permissionDenials: [],
    isError: false,
    errorMessage: null,
  };
}

const fullCommit = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";

const earlierEvidence = {
  id: "earlier",
  sessionId: "earlier-session",
  timestamp: 5,
  text: "Always format code cleanly with full variable names",
};

test("does not invoke a model or invent a starting commit from a branch or timestamp", async () => {
  const prepared = await prepareTasks({
    evidence: [{ id: "request", sessionId: "session", timestamp: 10, text: "Fix the parser on main" }],
    commits: new Set(["abc123"]), count: 5, since: 0, cwd: "/tmp",
    call: () => { throw new Error("Model must not run without commit evidence"); },
  });
  expect(prepared.tasks).toHaveLength(0);
  expect(prepared.exclusions).toHaveLength(1);
  expect(prepared.exclusions[0]?.reason).toContain("starting-commit");
});

test("uses resolved starting commit when commit resolver is provided", async () => {
  let modelInvoked = false;
  const trainingItem = {
    id: "earlier",
    sessionId: "earlier-session",
    timestamp: 5,
    text: "Always format code cleanly with full variable names",
  };
  const taskItem = {
    id: "task",
    sessionId: "task-session",
    timestamp: 10,
    text: "Refactor parser",
  };

  const prepared = await prepareTasks({
    evidence: [trainingItem, taskItem],
    commits: new Set(["abc1234"]),
    count: 1,
    since: 0,
    cwd: "/tmp",
    resolveCommit: async () => "abc1234",
    call: async () => {
      modelInvoked = true;
      return {
        engine: "codex",
        sessionId: "mock",
        transcriptPath: null,
        text: JSON.stringify({
          eligible: true,
          startingCommit: "abc1234",
          completion: ["Refactor parser"],
          preferences: [
            {
              requirement: "Clean code",
              evidenceId: "earlier",
              quote: "Always format code cleanly with full variable names",
            },
          ],
        }),
        structured: null,
        costUsd: null,
        durationMs: 10,
        turns: 1,
        actions: [],
        permissionDenials: [],
        isError: false,
        errorMessage: null,
      };
    },
    learnProfile: async () => "# Shadowclone profile\n\n## Rule\n\nClean",
  });

  expect(modelInvoked).toBeTrue();
  expect(prepared.tasks).toHaveLength(1);
  expect(prepared.tasks[0]?.startingCommit).toBe("abc1234");
});

test("resolves an abbreviated starting commit named in the request", async () => {
  const prepared = await prepareTasks({
    evidence: [
      earlierEvidence,
      {
        id: "task",
        sessionId: "task-session",
        timestamp: 10,
        text: "Refactor the parser starting at a1b2c3d",
      },
    ],
    commits: new Set([fullCommit]),
    count: 1,
    since: 0,
    cwd: "/tmp",
    call: async () =>
      engineResponse({
        eligible: true,
        completion: ["Refactor the parser"],
        preferences: [
          {
            requirement: "Clean code",
            evidenceId: "earlier",
            quote: earlierEvidence.text,
          },
        ],
      }),
    learnProfile: async () => "# Shadowclone profile\n\n## Rule\n\nClean",
  });

  expect(prepared.tasks).toHaveLength(1);
  expect(prepared.tasks[0]?.startingCommit).toBe(fullCommit);
});

test("excludes a candidate whose preference quote is not in the evidence", async () => {
  const prepared = await prepareTasks({
    evidence: [
      earlierEvidence,
      {
        id: "task",
        sessionId: "task-session",
        timestamp: 10,
        text: "Refactor the parser",
      },
    ],
    commits: new Set([fullCommit]),
    count: 1,
    since: 0,
    cwd: "/tmp",
    resolveCommit: async () => fullCommit,
    call: async () =>
      engineResponse({
        eligible: true,
        completion: ["Refactor the parser"],
        preferences: [
          {
            requirement: "Clean code",
            evidenceId: "earlier",
            quote: "a sentence the user never wrote",
          },
        ],
      }),
    learnProfile: async () => "# Shadowclone profile\n\n## Rule\n\nClean",
  });

  expect(prepared.tasks).toHaveLength(0);
  expect(
    prepared.exclusions.find(
      (exclusion) => exclusion.sessionId === "task-session",
    )?.reason,
  ).toContain("no matching user evidence");
});
