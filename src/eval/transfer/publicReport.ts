import { fingerprint } from "./structured";
import type { TransferReceipt } from "./types";

export function publicReport(receipt: TransferReceipt) {
  return {
    schemaVersion: 1,
    evalId: fingerprint(receipt.evalId),
    status: receipt.status,
    preparedFingerprint: receipt.preparedFingerprint,
    taskCount: receipt.prepared.tasks.length,
    suiteId: fingerprint(receipt.prepared.suiteId),
    runs: receipt.runs.map((run) => ({
      taskId: fingerprint(run.taskId),
      repeat: run.repeat,
      arm: run.arm,
      failed: run.failure !== null,
      phase: run.phase,
      durationMs: run.durationMs,
      taskCostUsd: run.costUsd,
      correctness: run.correctness.map((check) => check.verdict),
      preferences: run.preferences.map((check) => check.verdict),
    })),
  };
}
