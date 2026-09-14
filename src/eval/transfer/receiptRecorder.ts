import { redactSecrets } from "../../redact";
import { replaceRun } from "./runRecords";
import { recordProgress } from "./runProgress";
import { saveReceipt } from "./storage";
import type { EvaluationProgress, TransferReceipt, TransferRun } from "./types";

export function receiptRecorder(options: {
  readonly receipt: TransferReceipt;
  readonly directory: string;
  readonly json: boolean;
  readonly startedAt: number;
  readonly onProgress?: (progress: EvaluationProgress) => void;
}) {
  let receipt: TransferReceipt = { ...options.receipt, status: "running" };
  let writes: Promise<void> = Promise.resolve();
  let terminal = false;
  const enqueue = (operation: () => Promise<void>) => {
    writes = writes.then(operation);
    return writes;
  };
  return {
    get current() { return receipt; },
    run: (run: TransferRun) => enqueue(async () => {
      if (terminal) return;
      receipt = replaceRun({ receipt, run });
      await saveReceipt({ directory: options.directory, receipt });
    }),
    progress: (progress: Pick<EvaluationProgress, "stage" | "taskIndex" | "repeatIndex" | "arm"> & {
      readonly voteIndex?: number | null;
    }) => enqueue(async () => {
      if (terminal) return;
      receipt = await recordProgress({ ...options, ...progress, receipt });
    }),
    complete: (status: TransferReceipt["status"]) => enqueue(async () => {
      if (terminal) return;
      terminal = true;
      receipt = await recordProgress({
        ...options, receipt: { ...receipt, status }, stage: "complete",
        taskIndex: null, repeatIndex: null, arm: null,
      });
    }),
    fail: (failure: { readonly stage: "timeout" | "error"; readonly message: string }) => enqueue(async () => {
      if (terminal) return;
      terminal = true;
      receipt = {
        ...receipt, status: "error",
        runs: receipt.runs.map((run) => run.phase === "complete" || run.failure !== null || failure.stage !== "timeout" ? run : {
          ...run, failure: redactSecrets({ text: failure.message }).slice(0, 800),
          failureStage: run.observed === null ? "execution" as const : "judging" as const,
        }),
      };
      receipt = await recordProgress({
        ...options, receipt, stage: failure.stage,
        taskIndex: null, repeatIndex: null, arm: null,
      });
    }),
  };
}
