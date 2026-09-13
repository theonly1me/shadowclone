import { expect, test } from "bun:test";
import { preflightChecks } from "./preflight";

test("preflight requires only an isolated committed snapshot", () => {
  const checks = preflightChecks();

  expect(checks).toHaveLength(1);
  expect(checks.every((check) => check.verdict === "pass")).toBeTrue();
  expect(checks[0]?.evidence).toContain("without copying dependencies");
});
