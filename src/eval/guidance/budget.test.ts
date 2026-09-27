import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { evaluationBudget } from "../transfer/accounting";
import { modelCaller } from "../transfer/call";
import { parseGuidanceArguments } from "../../cli/guidanceEval";

test("the durable call ledger is the only invocation limit, including beyond 200", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "guidance-budget-"));

  try {
    const budget = await evaluationBudget({
      directory,
      resume: false,
      maximumCalls: 201,
      limitUsd: 5,
    });

    const call = modelCaller({
      budget,
      engine: "claude-code",
      model: "fixture",
      timeoutSeconds: 1,
      maxBudgetUsd: 5,
      runner: async () => ({
        engine: "claude-code",
        sessionId: "fixture",
        transcriptPath: null,
        text: "result",
        structured: null,
        costUsd: 0,
        durationMs: 0,
        turns: 1,
        isError: false,
        permissionDenials: [],
        actions: [],
        errorMessage: null,
      }),
    });

    for (let index = 0; index < 201; index += 1) {
      await call({ prompt: "Synthetic test", cwd: directory });
    }

    await expect(
      call({ prompt: "Synthetic test", cwd: directory }),
    ).rejects.toThrow("invocation limit");

    const resumed = await evaluationBudget({
      directory,
      resume: true,
      maximumCalls: 201,
      limitUsd: 5,
    });

    await expect(resumed.reserve()).rejects.toThrow("invocation limit");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a pilot cannot silently increase its five-dollar budget", () => {
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
      "--max-budget-usd",
      "50",
      "--max-calls",
      "28",
      "--deadline-seconds",
      "1500",
      "--pilot",
      "--scenario-file",
      "/cases.json",
      "--yes",
    ]),
  ).toThrow("Pilot budget");
});

test("preflight recovery requires an existing receipt and the previously observed CLI version", () => {
  const base = [
    "--protocol",
    "guidance-v1",
    "--repo",
    "/repo",
    "--model",
    "claude-sonnet-5",
    "--reasoning-effort",
    "medium",
    "--max-budget-usd",
    "5",
    "--max-calls",
    "28",
    "--deadline-seconds",
    "1500",
    "--pilot",
    "--yes",
  ];

  expect(() =>
    parseGuidanceArguments([
      ...base,
      "--suite-id",
      crypto.randomUUID(),
      "--recover-preflight-failure",
    ]),
  ).toThrow("observed --failed-cli-version");
  expect(() =>
    parseGuidanceArguments([
      ...base,
      "--eval-id",
      crypto.randomUUID(),
      "--recover-preflight-failure",
    ]),
  ).toThrow("observed --failed-cli-version");

  const parsed = parseGuidanceArguments([
    ...base,
    "--eval-id",
    crypto.randomUUID(),
    "--recover-preflight-failure",
    "--failed-cli-version",
    "2.1.267 (Claude Code)",
  ]);

  expect(parsed.recoverPreflightFailure).toBeTrue();
});
