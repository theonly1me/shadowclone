import { expect, test } from "bun:test";
import { parseRunArguments } from "./run";

test("parses a task and explicit per-run action approvals", () => {
  expect(
    parseRunArguments([
      "fix",
      "the",
      "test",
      "--approve",
      "push",
      "--approve",
      "pr-draft",
    ]),
  ).toEqual({
    task: "fix the test",
    approvedActions: ["push", "pr-draft"],
  });
});

test("rejects an unnamed or unsupported action approval", () => {
  expect(() =>
    parseRunArguments(["fix the test", "--approve", "merge"])
  ).toThrow("supported action");
});
