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

test("keeps a task word that starts with a dash", () => {
  expect(
    parseRunArguments(["remove", "the", "--deprecated", "flag", "--approve", "push"]),
  ).toEqual({
    task: "remove the --deprecated flag",
    approvedActions: ["push"],
  });
});

test("rejects an empty task by name", () => {
  expect(() => parseRunArguments([])).toThrow("Run requires a task");
  expect(() => parseRunArguments(["   "])).toThrow("Run requires a task");
});
