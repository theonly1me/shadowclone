import {
  distillSignalBatchSize,
  groupDistillBatches,
  type DistillBatch,
} from "../distill";
import { selectLearningEpisodes, type LearningState } from "../learning";
import type { CorrectionSignal } from "../signal";

const manualBatchLimit = 10;

export type ManualLearningWindow = {
  readonly signals: readonly CorrectionSignal[];
  readonly batches: readonly DistillBatch[];
};

export function selectManualLearningWindow(options: {
  readonly signals: readonly CorrectionSignal[];
  readonly state: LearningState;
  readonly now: number;
  readonly maximumCalls?: number;
}): ManualLearningWindow {
  const batchLimit = options.maximumCalls ?? manualBatchLimit;
  const pending = selectLearningEpisodes({
    ...options,
    ...(options.maximumCalls === undefined
      ? {}
      : { limit: options.maximumCalls * distillSignalBatchSize }),
  });
  const batches = groupDistillBatches({ signals: pending })
    .toSorted((left, right) =>
      (right.signals[0]?.timestamp ?? 0) -
      (left.signals[0]?.timestamp ?? 0)
    )
    .slice(0, batchLimit);
  return {
    batches,
    signals: batches.flatMap((batch) => batch.signals),
  };
}
