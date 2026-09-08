import {
  createLearningExecution,
  type EngineId,
  type EngineRunner,
  type LearningExecutionLimits,
} from "../engine";
import type { IndexedEvent } from "../index";
import type { ProfileRule } from "../profile";
import type { CorrectionSignal } from "../signal";
import { buildDistillPrompt, groupDistillBatches } from "./batch";
import { readCheckpoint, writeCheckpoint } from "./checkpoint";
import { allowlistedSignals } from "./eligible";
import { mergeDistilledRules } from "./merge";
import { profileRules } from "./profile";
import { distillationOutputSchema } from "./schema";

export { buildDistillPrompt, groupDistillBatches, type DistillBatch } from "./batch";
export { allowlistedSignals, isEligibleForDistillation } from "./eligible";
export { runReplay } from "./replay";
export {
  distillationMergeOutputSchema,
  distillationOutputSchema,
  parseDistilledRules,
  type DistilledRule,
} from "./schema";

export type DistillationResult = {
  readonly rules: readonly ProfileRule[];
  readonly engineRuns: number;
};

function structuredValue(run: {
  readonly structured: unknown;
  readonly text: string;
}): unknown {
  if (run.structured !== null && run.structured !== undefined) {
    return run.structured;
  }
  try {
    return JSON.parse(run.text);
  } catch {
    throw new Error("The engine returned no structured distillation result");
  }
}

export async function distillSignals(options: {
  readonly signals: readonly CorrectionSignal[];
  readonly runner: EngineRunner;
  readonly engine: EngineId;
  readonly limits?: LearningExecutionLimits;
  readonly workingDirectory: string;
  readonly checkpointDirectory: string;
  readonly events: readonly IndexedEvent[];
}): Promise<DistillationResult> {
  const execution = createLearningExecution({
    engine: options.engine,
    runner: options.runner,
    limits: options.limits,
  });
  const rules: ProfileRule[] = [];
  const signals = allowlistedSignals({
    signals: options.signals,
    events: options.events,
  }).filter((signal) => signal.textRefs.length > 0);

  for (const batch of groupDistillBatches({ signals })) {
    const checkpoint = await readCheckpoint({
      checkpointDirectory: options.checkpointDirectory,
      batch,
    });
    if (checkpoint !== null) {
      rules.push(...checkpoint);
      continue;
    }

    const prompt = await buildDistillPrompt({ signals: batch.signals });
    const run = await execution.runner({
      prompt,
      cwd: options.workingDirectory,
      execution: { purpose: "learning" },
      allowedTools: [],
      permissionMode: "dontAsk",
      outputSchema: distillationOutputSchema,
    });
    if (run.isError) {
      throw new Error("The agent engine failed during distillation");
    }
    const batchRules = profileRules({
      value: structuredValue(run),
      signals: batch.signals,
    });
    await writeCheckpoint({
      checkpointDirectory: options.checkpointDirectory,
      batch,
      rules: batchRules,
    });
    rules.push(...batchRules);
  }

  const rulesByOrigin = Map.groupBy(rules, (rule) => rule.originDirectory);
  const finalRules: ProfileRule[] = [];

  for (const [originDirectory, originRules] of rulesByOrigin.entries()) {
    if (originRules.length <= 1) {
      finalRules.push(...originRules);
      continue;
    }

    const mergedRaw = await mergeDistilledRules({
      rules: originRules.map((r) => ({
        title: r.title,
        body: r.body,
        section: r.section,
      })),
      runner: execution.runner,
      cwd: options.workingDirectory,
      checkpointDirectory: options.checkpointDirectory,
    });

    const originSignals = signals.filter(
      (s) => s.origin.directoryName === originDirectory,
    );
    finalRules.push(
      ...profileRules({
        value: { rules: mergedRaw },
        signals: originSignals,
        originRules,
      }),
    );
  }

  return { rules: finalRules, engineRuns: execution.callsUsed() };
}
