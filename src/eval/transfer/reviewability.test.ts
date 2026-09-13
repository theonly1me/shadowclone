import { expect, test } from "bun:test";
import { reviewabilityChecks } from "./reviewability";

test("requires a complete code change for blinded review", () => {
  const missing = reviewabilityChecks({
    repositoryChanged: false,
    truncated: false,
  });
  const truncated = reviewabilityChecks({
    repositoryChanged: true,
    truncated: true,
  });
  const complete = reviewabilityChecks({
    repositoryChanged: true,
    truncated: false,
  });

  expect(missing.map((check) => check.verdict)).toEqual(["fail", "pass"]);
  expect(truncated.map((check) => check.verdict)).toEqual(["pass", "fail"]);
  expect(complete.every((check) => check.verdict === "pass")).toBeTrue();
});
