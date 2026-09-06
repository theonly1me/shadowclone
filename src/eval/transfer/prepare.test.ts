import { expect, test } from "bun:test";
import { prepareTasks } from "./prepare";

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
