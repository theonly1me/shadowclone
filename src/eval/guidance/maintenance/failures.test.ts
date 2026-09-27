import { expect, test } from "bun:test";
import path from "node:path";
import type { EngineRunner } from "../../../engine";
import { candidateFixture } from "../fixtures";
import { runGuidanceEvaluation } from "../run";
import {
  guidanceDirectory,
  readGuidanceReceipt,
  saveGuidanceReceipt,
} from "../store";
import { maintenanceFixture } from "./fixtures";

test("an unknown-cost response stops immediately without saving or grading a candidate", async () => {
  const fixture = await maintenanceFixture();

  try {
    let calls = 0;

    const runner: EngineRunner = async () => {
      calls += 1;

      return {
        engine: "claude-code",
        resolvedModel: "claude-sonnet-5",
        sessionId: "fixture",
        transcriptPath: null,
        text: "Unpriced response",
        structured: null,
        costUsd: null,
        durationMs: 0,
        turns: 1,
        isError: false,
        permissionDenials: [],
        actions: [],
        errorMessage: null,
      };
    };

    const result = await runGuidanceEvaluation({ ...fixture.request, runner });

    expect(result.failure).toContain("cost is unknown");
    expect(result.runs).toHaveLength(0);
    expect(calls).toBe(1);

    const budgetPath = path.join(
      guidanceDirectory({ paths: fixture.paths, evalId: result.evalId }),
      "budget.json",
    );

    expect(await Bun.file(budgetPath).json()).toHaveProperty(
      "unknownCost",
      true,
    );
  } finally {
    await fixture.cleanup();
  }
}, 30000);

test("maintenance fails closed on unknown cost, limits, expiry, isolation, and model mismatch", async () => {
  const fixture = await maintenanceFixture();

  try {
    const initialized = await fixture.initialize();
    const directory = guidanceDirectory({
      paths: fixture.paths,
      evalId: initialized.evalId,
    });
    const budgetPath = path.join(directory, "budget.json");

    const baseBudget = {
      version: 1,
      limitUsd: 10,
      spentUsd: 0,
      calls: 0,
      maximumCalls: 48,
      pending: false,
      unknownCost: false,
    };

    let calls = 0;

    const runner: EngineRunner = async () => {
      calls += 1;

      return {
        engine: "claude-code",
        resolvedModel: "claude-sonnet-5-other",
        sessionId: "fixture",
        transcriptPath: null,
        text: "Synthetic mismatch",
        structured: null,
        costUsd: 0.01,
        durationMs: 0,
        turns: 1,
        isError: false,
        permissionDenials: [],
        actions: [],
        errorMessage: null,
      };
    };

    for (const changed of [
      { unknownCost: true },
      { pending: true },
      { spentUsd: 10 },
      { calls: 48 },
    ]) {
      await Bun.write(
        budgetPath,
        JSON.stringify({ ...baseBudget, ...changed }),
      );

      const result = await runGuidanceEvaluation({
        ...fixture.request,
        runner,
      });

      expect(result.status).toBe("error");
      expect(calls).toBe(0);
    }

    await Bun.write(budgetPath, JSON.stringify(baseBudget));

    const mismatch = await runGuidanceEvaluation({
      ...fixture.request,
      runner,
    });

    expect(mismatch.failure).toContain("approved maintenance model");
    expect(calls).toBe(1);
    expect(await Bun.file(budgetPath).json()).toHaveProperty("spentUsd", 0.01);

    await saveGuidanceReceipt({
      paths: fixture.paths,
      receipt: {
        ...initialized,
        runs: [{ ...candidateFixture(), arm: "bare", safety: "fail" }],
        status: "running",
      },
    });

    const unsafe = await runGuidanceEvaluation({ ...fixture.request, runner });

    expect(unsafe.failure).toContain("snapshot safety");
    expect(calls).toBe(1);

    await saveGuidanceReceipt({
      paths: fixture.paths,
      receipt: { ...initialized, deadlineAt: 1 },
    });

    await expect(
      runGuidanceEvaluation({ ...fixture.request, runner }),
    ).rejects.toThrow("deadline has expired");
    expect(
      (
        await readGuidanceReceipt({
          paths: fixture.paths,
          evalId: initialized.evalId,
        })
      ).deadlineAt,
    ).toBe(1);
    expect(calls).toBe(1);
  } finally {
    await fixture.cleanup();
  }
}, 30000);
