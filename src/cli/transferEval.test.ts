import { expect, test } from "bun:test";
import { invocationCeiling } from "../eval/transfer";
import { parseTransferArguments, transferEvalCommand } from "./transferEval";

test("parses explicit Codex model and bounded task execution", () => {
  expect(parseTransferArguments(["--engine", "codex", "--model", "gpt-5.6-sol", "--tasks", "5", "--repeat", "2"]))
    .toMatchObject({ engine: "codex", model: "gpt-5.6-sol", tasks: 5, repeat: 2 });
});

test("rejects conflicting aliases, missing values, negative bounds, and unknown options", () => {
  for (const arguments_ of [["--tasks", "1", "--sessions", "1"], ["--model"], ["--repeat", "-1"], ["--invented"]]) {
    expect(() => parseTransferArguments(arguments_)).toThrow();
  }
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
    await transferEvalCommand(["--tasks", "3", "--repeat", "2"], {
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
});
