import type { EvaluationArm } from "./arms";
import { progressLine } from "./progress";
import { saveReceipt } from "./storage";
import type {
  EvaluationProgress,
  TransferReceipt,
} from "./types";

export async function recordProgress(options: {
  readonly receipt: TransferReceipt;
  readonly directory: string;
  readonly json: boolean;
  readonly startedAt: number;
  readonly stage: EvaluationProgress["stage"];
  readonly taskIndex: number | null;
  readonly repeatIndex: number | null;
  readonly arm: EvaluationArm | null;
  readonly voteIndex?: number | null;
  readonly onProgress?: (progress: EvaluationProgress) => void;
}): Promise<TransferReceipt> {
  const progress: EvaluationProgress = {
    stage: options.stage,
    taskIndex: options.taskIndex,
    taskCount: options.receipt.prepared.tasks.length,
    repeatIndex: options.repeatIndex,
    repeatCount: options.receipt.prepared.repeat,
    arm: options.arm,
    voteIndex: options.voteIndex ?? null,
    voteCount: options.stage === "judging" ? 3 : null,
    updatedAt: new Date().toISOString(),
  };
  const receipt = { ...options.receipt, progress };
  await saveReceipt({ directory: options.directory, receipt });
  options.onProgress?.(progress);
  if (!options.json) {
    console.log(progressLine({ progress, startedAt: options.startedAt }));
  }
  return receipt;
}
