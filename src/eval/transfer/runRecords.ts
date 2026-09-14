import type { EvaluationArm } from "./arms";
import type { TransferReceipt, TransferRun } from "./types";

export function replaceRun(options: {
  readonly receipt: TransferReceipt;
  readonly run: TransferRun;
}): TransferReceipt {
  const remaining = options.receipt.runs.filter((run) =>
    run.taskId !== options.run.taskId ||
    run.repeat !== options.run.repeat ||
    run.arm !== options.run.arm
  );
  return { ...options.receipt, runs: [...remaining, options.run] };
}

export function matchingRun(options: {
  readonly receipt: TransferReceipt;
  readonly taskId: string;
  readonly repeat: number;
  readonly arm: EvaluationArm;
}): TransferRun | undefined {
  return options.receipt.runs.find((run) =>
    run.taskId === options.taskId &&
    run.repeat === options.repeat &&
    run.arm === options.arm
  );
}
