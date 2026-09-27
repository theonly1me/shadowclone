import { expect, test } from "bun:test";
import path from "node:path";
import type { EngineRunner } from "../../engine";
import { ownedWrite } from "../../storage";
import { runGuidanceEvaluation } from "./run";
import {
  guidanceDirectory,
  readGuidanceReceipt,
  saveGuidanceReceipt,
} from "./store";
import { runValidation } from "./validation";
import { validationFixture } from "./validation.fixtures";

test("a resolved model mismatch stops after one accounted invocation", async () => {
  const fixture = await validationFixture();

  try {
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

    const result = await runGuidanceEvaluation({ ...fixture.options, runner });

    expect(result.status).toBe("error");
    expect(result.failure).toContain("differs from the original pilot");
    expect(calls).toBe(1);

    const ledger = await Bun.file(
      path.join(
        guidanceDirectory({ paths: fixture.paths, evalId: result.evalId }),
        "budget.json",
      ),
    ).json();

    expect(ledger.calls).toBe(1);
    expect(ledger.spentUsd).toBe(0.01);
  } finally {
    await fixture.cleanup();
  }
}, 30000);

test("linked validation preserves unresolved child cost and expired deadlines", async () => {
  const fixture = await validationFixture();

  try {
    const initialized = await runValidation({
      options: fixture.options,
      execute: async (request) =>
        readGuidanceReceipt({
          paths: fixture.paths,
          evalId: request.evalId ?? "",
        }),
    });

    const directory = guidanceDirectory({
      paths: fixture.paths,
      evalId: initialized.evalId,
    });

    await ownedWrite({
      path: path.join(directory, "budget.json"),
      content: JSON.stringify({
        version: 1,
        limitUsd: initialized.limitUsd,
        spentUsd: 0.02,
        calls: 2,
        maximumCalls: 48,
        pending: true,
        unknownCost: false,
      }),
    });

    const result = await runGuidanceEvaluation(fixture.options);

    expect(result.status).toBe("error");
    expect(result.failure).toContain("cost unknown");
    expect(
      await Bun.file(path.join(directory, "budget.json")).json(),
    ).toHaveProperty("unknownCost", true);

    await saveGuidanceReceipt({
      paths: fixture.paths,
      receipt: { ...result, deadlineAt: 1 },
    });

    await expect(runGuidanceEvaluation(fixture.options)).rejects.toThrow(
      "deadline has expired",
    );
    expect(
      (
        await readGuidanceReceipt({
          paths: fixture.paths,
          evalId: result.evalId,
        })
      ).deadlineAt,
    ).toBe(1);
  } finally {
    await fixture.cleanup();
  }
}, 30000);
