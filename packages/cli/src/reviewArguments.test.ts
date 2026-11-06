import { expect, test } from "bun:test";
import { parseReviewArguments, reviewUsage } from "./reviewArguments";

test("a pull request number alone runs a local review with checks and lens runs under the default cost limit", () => {
  expect(parseReviewArguments(["42"])).toEqual({
    target: { kind: "pull", number: 42 },
    repository: null,
    runChecks: true,
    network: true,
    cloud: false,
    output: null,
    model: "claude-opus-5-5",
    effort: null,
    lenses: { enabled: true, maxCostUsd: 4 },
  });
});

test("--no-checks and --cloud are switches that take no value", () => {
  const parsed = parseReviewArguments(["--no-checks", "7", "--cloud"]);

  expect([parsed.target, parsed.runChecks, parsed.cloud]).toEqual([{ kind: "pull", number: 7 }, false, true]);
});

test("an unknown flag or a second positional shows the usage", () => {
  expect(() => parseReviewArguments(["7", "--post"])).toThrow(reviewUsage);
  expect(() => parseReviewArguments(["7", "8"])).toThrow(reviewUsage);
});

test("no number reviews the current branch, from --base when it is given", () => {
  expect(parseReviewArguments(["--no-checks"]).target).toEqual({ kind: "branch", base: null });
  expect(parseReviewArguments(["--base", "origin/main"]).target).toEqual({ kind: "branch", base: "origin/main" });
});

test("--base with a pull request number, or a base that looks like a flag, shows the usage", () => {
  expect(() => parseReviewArguments(["7", "--base", "main"])).toThrow(reviewUsage);
  expect(() => parseReviewArguments(["--base", "--upload-pack=touch"])).toThrow(reviewUsage);
});

test("a cloud review without a pull request number is refused", () => {
  expect(() => parseReviewArguments(["--cloud"])).toThrow("needs a pull request number");
});

test("--no-lenses turns lens runs off, --max-cost sets the limit, and a limit of 0 is refused", () => {
  expect(parseReviewArguments(["42", "--no-lenses"]).lenses).toEqual({ enabled: false });
  expect(parseReviewArguments(["42", "--max-cost", "6.5"]).lenses).toEqual({ enabled: true, maxCostUsd: 6.5 });
  expect(() => parseReviewArguments(["42", "--max-cost", "0"])).toThrow("--max-cost takes a dollar amount above 0");
});
