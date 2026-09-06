import { expect, test } from "bun:test";
import { buildCodexArguments } from "../codex";
import { parseCodexStream } from "../parseCodex";

function parseStreamEvents(events: readonly unknown[]) {
  return parseCodexStream({
    stream: events.map((event) => JSON.stringify(event)).join("\n"),
    fallbackSessionId: "fallback",
    durationMs: 20,
  });
}

test("retains ordered completed actions once and distinguishes failed commands", () => {
  const commandItem = {
    type: "item.completed",
    item: {
      id: "command",
      type: "command_execution",
      command: "bun test",
      exit_code: 1,
    },
  };
  const editItem = {
    type: "item.completed",
    item: {
      id: "edit",
      type: "file_change",
      status: "completed",
      changes: [{ path: "src/result.ts", kind: "update" }],
    },
  };
  const run = parseStreamEvents([
    { type: "thread.started", thread_id: "thread" },
    commandItem,
    commandItem,
    editItem,
    { type: "turn.completed" },
  ]);
  expect(run.actions).toEqual([
    { tool: "Bash", path: null, command: "bun test", succeeded: false },
    { tool: "Edit", path: "src/result.ts", succeeded: true },
  ]);
  expect(run.isError).toBeFalse();
});

test("rejects truncated streams and surfaces failures", () => {
  expect(parseStreamEvents([{ type: "thread.started" }]).isError).toBeTrue();
  const run = parseStreamEvents([
    { type: "turn.failed", error: { message: "Quota exhausted" } },
  ]);
  expect(run.errorMessage).toBe("Quota exhausted");
  expect(run.isError).toBeTrue();
});

test("evaluation forwards the exact model and only enables writes for execution", () => {
  const runConfig = {
    prompt: "task",
    cwd: "/tmp/task",
    model: "gpt-5.6-sol",
    evaluation: true,
  };
  const executionArguments = buildCodexArguments({ run: runConfig });
  expect(executionArguments).toContain("gpt-5.6-sol");
  expect(executionArguments).toContain("workspace-write");
  expect(executionArguments).toContain("--ephemeral");
  expect(
    buildCodexArguments({ run: { ...runConfig, allowedTools: [] } }),
  ).toContain("read-only");
  expect(() =>
    buildCodexArguments({ run: { ...runConfig, maxBudgetUsd: 1 } }),
  ).toThrow("dollar budget");
});
