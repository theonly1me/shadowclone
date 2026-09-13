import {
  createLearningExecution,
  type EngineId,
  type EngineRunner,
  type LearningExecutionLimits,
  type LearningExecution,
} from "../engine";
import type { IndexedEvent } from "../index";
import type { ProfileRule, ProfileSnapshot } from "../profile";
import type { CorrectionSignal } from "../signal";
import type { SeedLibrary } from "../skills";
import {
  finalizeReconciliationChanges,
  mergeProfileRuleUpdates,
} from "./aggregate";
import { distillConcurrency, groupDistillBatches } from "./batch";
import { mapWithConcurrency } from "./concurrency";
import { consolidateNewRules } from "./consolidate";
import { allowlistedSignals } from "./eligible";
import { materializeEvidence } from "./excerpts";
import {
  applyReconciliation,
  buildReconciliationPrompt,
  createReconciliationContext,
  runReconciliation,
  type ReconciliationChange,
} from "./reconcile";

export { distillConcurrency, distillSignalBatchSize, groupDistillBatches, type DistillBatch } from "./batch";
export { checkpointId, reconciliationLearnerVersion } from "./checkpoint";
export { allowlistedSignals, isEligibleForDistillation } from "./eligible";
export {
  buildReconciliationPrompt,
  parseReconciliationOutput,
  reconciliationOutputSchema,
  renderReconciliationChanges,
  type ReconciliationChange,
  type ReconciliationOutput,
} from "./reconcile";
export { runReplay } from "./replay";
export {
  distillationMergeOutputSchema,
  parseDistilledRules,
  type DistilledRule,
} from "./schema";

export type DistillationResult = {
  readonly rules: readonly ProfileRule[];
  readonly changes: readonly ReconciliationChange[];
  readonly engineRuns: number;
  readonly rejectedMatches: number;
};

const emptyProfile: ProfileSnapshot = { rules: [], rejections: [] };
const emptyLibrary: SeedLibrary = {
  guidance: [],
  preferences: [],
  skills: [],
  axes: [],
  independentSkills: [],
};

export async function distillSignals(options: {
  readonly signals: readonly CorrectionSignal[];
  readonly runner: EngineRunner;
  readonly engine: EngineId;
  readonly limits?: LearningExecutionLimits;
  readonly workingDirectory: string;
  readonly checkpointDirectory?: string | null;
  readonly events: readonly IndexedEvent[];
  readonly profile?: ProfileSnapshot;
  readonly seedLibrary?: SeedLibrary;
  readonly execution?: LearningExecution;
}): Promise<DistillationResult> {
  const execution = options.execution ?? createLearningExecution({
    engine: options.engine,
    runner: options.runner,
    limits: options.limits,
  });
  const eligible = allowlistedSignals({
    signals: options.signals,
    events: options.events,
  }).filter((signal) => signal.textRefs.length > 0);
  const { signals, excerpts } = await materializeEvidence(eligible);
  const appliedRules: ProfileRule[] = [];
  const changes: ReconciliationChange[] = [];
  let rejectedMatches = 0;

  const batchResults = await mapWithConcurrency({
    items: groupDistillBatches({ signals }),
    limit: distillConcurrency,
    run: async (batch) => {
      const context = createReconciliationContext({
        batch,
        profile: options.profile ?? emptyProfile,
        library: options.seedLibrary ?? emptyLibrary,
      });
      const prompt = await buildReconciliationPrompt({ context, excerpts });
      const output = await runReconciliation({
        prompt,
        runner: execution.runner,
        workingDirectory: options.workingDirectory,
        ...(options.checkpointDirectory
          ? { checkpointDirectory: options.checkpointDirectory }
          : {}),
      });
      return { output, context };
    },
  });
  for (const { output, context } of batchResults) {
    const applied = applyReconciliation({ output, context });
    appliedRules.push(...applied.rules);
    changes.push(...applied.changes);
    rejectedMatches += applied.rejectedMatches;
  }

  const newKeys = new Set(
    changes.filter((change) => change.kind === "new").map((change) => change.after.key),
  );
  const existingRules = mergeProfileRuleUpdates(
    appliedRules.filter((rule) => !newKeys.has(rule.key)),
  );
  const newRules = await consolidateNewRules({
    rules: appliedRules.filter((rule) => newKeys.has(rule.key)),
    runner: execution.runner,
    workingDirectory: options.workingDirectory,
    ...(options.checkpointDirectory
      ? { checkpointDirectory: options.checkpointDirectory }
      : {}),
  });
  return {
    rules: [...existingRules, ...newRules],
    changes: finalizeReconciliationChanges({ changes, existingRules, newRules }),
    engineRuns: execution.callsUsed(),
    rejectedMatches,
  };
}
