import { expect, test } from "bun:test";
import { parseTransferArguments } from "./transferEval";

test("parses explicit Codex model and bounded task execution", () => {
  expect(parseTransferArguments(["--engine", "codex", "--model", "gpt-5.6-sol", "--tasks", "5", "--repeat", "2"]))
    .toMatchObject({ engine: "codex", model: "gpt-5.6-sol", tasks: 5, repeat: 2 });
});

test("rejects conflicting aliases, missing values, negative bounds, and unknown options", () => {
  for (const arguments_ of [["--tasks", "1", "--sessions", "1"], ["--model"], ["--repeat", "-1"], ["--invented"]]) {
    expect(() => parseTransferArguments(arguments_)).toThrow();
  }
});
