import { expect, test } from "bun:test";
import { parseGuidanceArguments } from "../../../cli/guidanceEval";

test("maintenance CLI requires a distinct explicit additional allowance and exact model", () => {
  const base = [
    "--protocol",
    "guidance-v1",
    "--repo",
    "/repo",
    "--model",
    "claude-sonnet-5",
    "--reasoning-effort",
    "medium",
    "--max-calls",
    "48",
    "--deadline-seconds",
    "2700",
    "--maintenance-of",
    crypto.randomUUID(),
    "--suite-id",
    crypto.randomUUID(),
    "--yes",
  ];

  expect(
    parseGuidanceArguments([...base, "--additional-budget-usd", "10"]),
  ).toHaveProperty("additionalBudgetUsd", 10);
  expect(() => parseGuidanceArguments(base)).toThrow("additional budget");

  for (const extra of [
    ["--max-budget-usd", "10"],
    ["--cumulative-budget-usd", "10"],
    ["--pilot"],
    ["--validation-of", crypto.randomUUID()],
    ["--max-calls", "49"],
    ["--model", "claude-sonnet-5-other"],
  ]) {
    expect(() =>
      parseGuidanceArguments([
        ...base,
        "--additional-budget-usd",
        "10",
        ...extra,
      ]),
    ).toThrow();
  }
});
