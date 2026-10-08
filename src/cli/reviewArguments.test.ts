import { expect, test } from "bun:test";
import { parseReviewArguments, reviewUsage } from "./reviewArguments";

test("a pull request number alone runs a local review with checks", () => {
  expect(parseReviewArguments(["42"])).toEqual({
    number: 42,
    repository: null,
    runChecks: true,
    cloud: false,
    output: null,
    model: "claude-opus-5-5",
    effort: "high",
  });
});

test("--no-checks and --cloud are switches that take no value", () => {
  const parsed = parseReviewArguments(["--no-checks", "7", "--cloud"]);

  expect([parsed.number, parsed.runChecks, parsed.cloud]).toEqual([7, false, true]);
});

test("an unknown flag or a missing number shows the usage", () => {
  expect(() => parseReviewArguments(["7", "--post"])).toThrow(reviewUsage);
  expect(() => parseReviewArguments(["--no-checks"])).toThrow(reviewUsage);
});
