import { executeTask } from "./execute";
import { printReport } from "./report";
import { saveReceipt } from "./storage";
import type { ModelCall, TransferReceipt } from "./types";

export async function executeTransferRuns(options: {
  receipt: TransferReceipt;
  readonly directory: string;
  readonly controlDirectory: string;
  readonly call: ModelCall;
  readonly json: boolean;
}): Promise<TransferReceipt> {
  let currentReceipt = options.receipt;

  for (const task of currentReceipt.prepared.tasks) {
    for (
      let repetition = 0;
      repetition < currentReceipt.prepared.repeat;
      repetition++
    ) {
      const arms =
        repetition % 2 === 0
          ? (["baseline", "clone"] as const)
          : (["clone", "baseline"] as const);

      for (const arm of arms) {
        const alreadyRun = currentReceipt.runs.some(
          (run) =>
            run.taskId === task.id &&
            run.repeat === repetition &&
            run.arm === arm,
        );
        if (alreadyRun) {
          continue;
        }

        const run = await executeTask({
          prepared: currentReceipt.prepared,
          task,
          repeat: repetition,
          arm,
          call: options.call,
          judgeDirectory: options.controlDirectory,
        });

        currentReceipt = {
          ...currentReceipt,
          runs: [...currentReceipt.runs, run],
        };

        await saveReceipt({
          directory: options.directory,
          receipt: currentReceipt,
        });

        if (run.failure) {
          printReport({ receipt: currentReceipt, json: options.json });
          return currentReceipt;
        }
      }
    }
  }

  currentReceipt = {
    ...currentReceipt,
    status:
      currentReceipt.prepared.tasks.length > 0
        ? "complete"
        : "insufficient-evidence",
  };

  await saveReceipt({
    directory: options.directory,
    receipt: currentReceipt,
  });

  printReport({ receipt: currentReceipt, json: options.json });

  return currentReceipt;
}
