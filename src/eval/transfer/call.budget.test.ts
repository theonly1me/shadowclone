import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { EngineRun } from "../../engine";
import { evaluationBudget } from "./accounting";
import { modelCaller } from "./call";

test("evaluation callers share remaining dollars and account for failed provider calls", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-call-budget-"),
  );
  try {
    const received: (number | undefined)[] = [];
    const budget = await evaluationBudget({
      directory,
      resume: false,
      limitUsd: 2,
      maximumCalls: 20,
    });
    const call = modelCaller({
      budget,
      engine: "claude-code",
      model: "fixture",
      timeoutSeconds: 1,
      maxBudgetUsd: 2,
      runner: async (options): Promise<EngineRun> => {
        received.push(options.maxBudgetUsd);
        return {
          engine: "claude-code",
          sessionId: "fixture",
          transcriptPath: null,
          text: "",
          structured: null,
          costUsd: 1,
          durationMs: 1,
          turns: 1,
          isError: true,
          permissionDenials: [],
          actions: [],
          errorMessage: "fixture failure",
        };
      },
    });
    const request = { prompt: "synthetic request", cwd: directory };
    await expect(call(request)).rejects.toThrow("fixture failure");
    await expect(call(request)).rejects.toThrow("fixture failure");
    await expect(call(request)).rejects.toThrow("total budget");
    expect(received).toEqual([2, 1]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
