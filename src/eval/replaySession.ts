import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { EngineRunner } from "../engine";
import {
  extractBehaviorFromActions,
} from "./behavior";
import { computeScoreDelta, scoreReplay } from "./score";
import type {
  EvalSessionResult,
  EvalSkippedSession,
  SessionBehavior,
} from "./types";

export type ReplayOutcome =
  | { readonly result: EvalSessionResult }
  | { readonly skipped: EvalSkippedSession };

export async function replaySession(options: {
  readonly sessionId: string;
  readonly prompt: string;
  readonly actual: SessionBehavior;
  readonly compiledProfilePath: string;
  readonly runner: EngineRunner;
  readonly maxBudgetUsd?: number;
}): Promise<ReplayOutcome> {
  const baselineCwd = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-eval-base-"),
  );
  const cloneCwd = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-eval-clone-"),
  );

  try {
    const baselineRun = await options.runner({
      prompt: options.prompt,
      cwd: baselineCwd,
      sessionId: crypto.randomUUID(),
      permissionMode: "dontAsk",
      maxBudgetUsd: options.maxBudgetUsd ?? 0.5,
    });

    if (baselineRun.isError) {
      const reason = baselineRun.errorMessage ?? "baseline replay failed";
      return {
        skipped: {
          sessionId: options.sessionId,
          prompt: options.prompt,
          phase: "baseline",
          reason,
        },
      };
    }

    const baselineBehavior = extractBehaviorFromActions({
      actions: baselineRun.actions,
    });
    const baselineScore = scoreReplay({
      actual: options.actual,
      clone: baselineBehavior,
    });

    const cloneRun = await options.runner({
      prompt: options.prompt,
      cwd: cloneCwd,
      systemPromptFile: options.compiledProfilePath,
      sessionId: crypto.randomUUID(),
      permissionMode: "dontAsk",
      maxBudgetUsd: options.maxBudgetUsd ?? 0.5,
    });

    if (cloneRun.isError) {
      const reason = cloneRun.errorMessage ?? "clone replay failed";
      return {
        skipped: {
          sessionId: options.sessionId,
          prompt: options.prompt,
          phase: "clone",
          reason,
        },
      };
    }

    const cloneBehavior = extractBehaviorFromActions({
      actions: cloneRun.actions,
    });
    const cloneScore = scoreReplay({
      actual: options.actual,
      clone: cloneBehavior,
    });

    const delta = computeScoreDelta({
      baseline: baselineScore,
      clone: cloneScore,
    });

    return {
      result: {
        sessionId: options.sessionId,
        baselineSessionId: baselineRun.sessionId,
        cloneSessionId: cloneRun.sessionId,
        prompt: options.prompt,
        baseline: baselineScore,
        clone: cloneScore,
        delta,
      },
    };
  } finally {
    await rm(baselineCwd, { recursive: true, force: true });
    await rm(cloneCwd, { recursive: true, force: true });
  }
}
