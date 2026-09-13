import { expect, test } from "bun:test";
import { invocationCeiling } from "../eval/transfer";
import { parseTransferArguments, transferEvalCommand } from "./transferEval";

test("invocation ceiling reserves task preparation and execution calls", () => {
  expect(invocationCeiling({ tasks: 1, repeat: 1 })).toBe(15);
});

test("parses explicit Codex model and bounded task execution", () => {
  expect(
    parseTransferArguments([
      "--engine",
      "codex",
      "--model",
      "gpt-5.6-luna",
      "--reasoning-effort",
      "xhigh",
      "--dependency-mode",
      "current",
      "--tasks",
      "5",
      "--repeat",
      "2",
    ]),
  ).toMatchObject({
    engine: "codex",
    model: "gpt-5.6-luna",
    reasoningEffort: "xhigh",
    dependencyMode: "current",
    tasks: 5,
    repeat: 2,
  });
});

test("rejects conflicting task inputs, removed history flags, and invalid values", () => {
  for (const arguments_ of [
    ["--task", "Fix it", "--tasks", "1"],
    ["--suite-id", "suite", "--task", "Fix it"],
    ["--eval-id", "evaluation", "--tasks", "1"],
    ["--eval-id", "evaluation", "--task", "Fix it"],
    ["--sessions", "1"],
    ["--since", "yesterday"],
    ["--model"],
    ["--repeat", "-1"],
    ["--reasoning-effort", "extreme"],
    ["--dependency-mode", "strict"],
    ["--invented"],
  ]) {
    expect(() => parseTransferArguments(arguments_)).toThrow();
  }
});

test("rejects a value flag given twice instead of taking the last one", () => {
  expect(() => parseTransferArguments(["--repo", "a", "--repo", "b"])).toThrow(
    "Repeated --repo",
  );
  expect(() => parseTransferArguments(["--tasks", "1", "--tasks", "2"])).toThrow(
    "Repeated --tasks",
  );
  expect(() =>
    parseTransferArguments([
      "--reasoning-effort",
      "high",
      "--reasoning-effort",
      "xhigh",
    ]),
  ).toThrow("Repeated --reasoning-effort");
  expect(parseTransferArguments(["--repo", "a"]).repo).toBe("a");
});

test("carries the confirmation bypass instead of discarding it", () => {
  expect(parseTransferArguments(["--yes"]).yes).toBeTrue();
  expect(parseTransferArguments(["-y"]).yes).toBeTrue();
  expect(parseTransferArguments([]).yes).toBeFalse();
});

test("previews the invocation ceiling and cancels before spending when declined", async () => {
  const questions: string[] = [];
  const originalIsTTY = process.stdin.isTTY;

  try {
    process.stdin.isTTY = true;
    await transferEvalCommand([
      "--engine",
      "codex",
      "--model",
      "gpt-5.6-luna",
      "--reasoning-effort",
      "xhigh",
      "--tasks",
      "3",
      "--repeat",
      "2",
    ], {
      ask: (question) => {
        questions.push(question);
        return false;
      },
    });
  } finally {
    process.stdin.isTTY = originalIsTTY;
  }

  expect(questions).toHaveLength(1);
  expect(questions[0]).toContain(
    `${invocationCeiling({ tasks: 3, repeat: 2 })} agent invocations`,
  );
  expect(questions[0]).toContain("codex gpt-5.6-luna xhigh effort");
  expect(questions[0]).toContain("each up to 1200s");
});
