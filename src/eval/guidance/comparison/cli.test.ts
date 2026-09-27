import { expect, test } from "bun:test";
import { parseGuidanceArguments } from "../../../cli/guidanceEval";

test("comparison CLI has its own approved limits without increasing maintenance limits", () => {
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
    "96",
    "--deadline-seconds",
    "5400",
    "--comparison-of",
    crypto.randomUUID(),
    "--yes",
  ];

  expect(
    parseGuidanceArguments([...base, "--additional-budget-usd", "20"]),
  ).toHaveProperty("additionalBudgetUsd", 20);
  expect(() => parseGuidanceArguments(base)).toThrow("additional budget");

  for (const extra of [
    ["--max-budget-usd", "20"],
    ["--cumulative-budget-usd", "10"],
    ["--pilot"],
    ["--suite-id", crypto.randomUUID()],
    ["--maintenance-of", crypto.randomUUID()],
    ["--validation-of", crypto.randomUUID()],
    ["--max-calls", "97"],
    ["--deadline-seconds", "5401"],
    ["--model", "claude-sonnet-5-other"],
    ["--additional-budget-usd", "21"],
  ]) {
    expect(() =>
      parseGuidanceArguments([
        ...base,
        "--additional-budget-usd",
        "20",
        ...extra,
      ]),
    ).toThrow();
  }

  expect(() =>
    parseGuidanceArguments([
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
      "--additional-budget-usd",
      "20",
      "--yes",
    ]),
  ).toThrow();
});
