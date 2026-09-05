import { expect, test } from "bun:test";
import {
  buildClaudeArguments,
  detectEngine,
  parseClaudeStream,
} from "./index";

test("parses a recorded Claude stream without spawning a process", async () => {
  const stream = await Bun.file(
    new URL("fixtures/claude-stream.jsonl", import.meta.url),
  ).text();
  const run = parseClaudeStream({
    stream,
    fallbackSessionId: "fallback",
  });

  expect(run.sessionId).toBe("session-fixture");
  expect(run.text).toBe("Implemented the focused change.");
  expect(run.structured).toEqual({ rules: [] });
  expect(run.costUsd).toBe(0.012);
  expect(run.turns).toBe(2);
  expect(run.permissionDenials).toEqual([
    { toolName: "Bash", toolUseId: "tool-1" },
  ]);
  expect(run.isError).toBeFalse();
});

test("builds bounded Claude arguments without a prompt or bypass mode", () => {
  const arguments_ = buildClaudeArguments({
    sessionId: "00000000-0000-4000-8000-000000000000",
    run: {
      prompt: "private prompt",
      cwd: "/worktree",
      systemPromptFile: "/profile.md",
      allowedTools: [],
      permissionMode: "dontAsk",
      maxBudgetUsd: 1,
    },
  });

  expect(arguments_).toContain("--append-system-prompt-file");
  expect(arguments_).toContain("--allowedTools");
  expect(arguments_).toContain("dontAsk");
  expect(arguments_).not.toContain("private prompt");
  expect(arguments_).not.toContain("bypassPermissions");
  expect(arguments_).not.toContain("--dangerously-skip-permissions");
});

test("detects Claude only when it is installed and authenticated", async () => {
  const checked: string[] = [];
  const detection = await detectEngine({
    probe: (command) => {
      checked.push(command.join(" "));
      return Promise.resolve(true);
    },
  });

  expect(checked).toEqual(["claude --version", "claude auth status"]);
  expect(detection.availability[0]?.authenticated).toBeTrue();
  expect(detection.runner).not.toBeNull();
});
