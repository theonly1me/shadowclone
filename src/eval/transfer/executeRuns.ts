import { evaluationDeadlineError, evaluationSignal } from "./deadline";
import { type ExecutionStage, executeTask } from "./execute";
import { evaluationArmOrder, type EvaluationArm } from "./arms";
import { gradeArms, hasGradeableEvidence } from "./gradePair";
import { matchingRun, replaceRun } from "./runRecords";
import { evaluationStatus, printReport } from "./report";
import { recordProgress } from "./runProgress";
import { saveReceipt } from "./storage";
import type {
  EvaluationProgress,
  ModelCall,
  TransferReceipt,
  TransferRun,
} from "./types";

export async function executeTransferRuns(options: {
  receipt: TransferReceipt;
  readonly directory: string;
  readonly controlDirectory: string;
  readonly call: ModelCall;
  readonly json: boolean;
  readonly startedAt: number;
  readonly onProgress?: (progress: EvaluationProgress) => void;
}): Promise<TransferReceipt> {
  let currentReceipt: TransferReceipt = {
    ...options.receipt,
    status: "running",
  };
  let progressWrite: Promise<void> = Promise.resolve();

  async function updateProgress(progressOptions: {
    readonly stage: EvaluationProgress["stage"];
    readonly taskIndex: number | null;
    readonly repeatIndex: number | null;
    readonly arm: EvaluationArm | null;
    readonly voteIndex?: number | null;
  }): Promise<void> {
    progressWrite = progressWrite.then(async () => {
      currentReceipt = await recordProgress({
        ...progressOptions,
        receipt: currentReceipt,
        directory: options.directory,
        json: options.json,
        startedAt: options.startedAt,
        onProgress: options.onProgress,
      });
    });
    await progressWrite;
  }

  async function stopWithError(stopOptions: {
    readonly stage: "error" | "timeout";
    readonly message: string;
  }): Promise<never> {
    await progressWrite;
    currentReceipt = { ...currentReceipt, status: "error" };
    await updateProgress({
      stage: stopOptions.stage,
      taskIndex: null,
      repeatIndex: null,
      arm: null,
    });
    printReport({ receipt: currentReceipt, json: options.json });
    throw new Error(stopOptions.message);
  }

  async function stopIfExpired(): Promise<void> {
    if (evaluationSignal()?.aborted) {
      await stopWithError({
        stage: "timeout",
        message: `${evaluationDeadlineError().message}. Resume with --eval-id ${currentReceipt.evalId}`,
      });
    }
  }

  async function stopOnFailure(runs: readonly TransferRun[]): Promise<void> {
    await stopIfExpired();
    if (runs.some((run) => run.failure !== null)) {
      await stopWithError({
        stage: "error",
        message: `Evaluation infrastructure failed. Resume with --eval-id ${currentReceipt.evalId}`,
      });
    }
  }

  for (const [taskOffset, task] of currentReceipt.prepared.tasks.entries()) {
    await stopIfExpired();
    for (
      let repetition = 0;
      repetition < currentReceipt.prepared.repeat;
      repetition += 1
    ) {
      await stopIfExpired();
      const taskIndex = taskOffset + 1;
      const repeatIndex = repetition + 1;
      const existingRuns = evaluationArmOrder.map((arm) =>
        matchingRun({
          receipt: currentReceipt,
          taskId: task.id,
          repeat: repetition,
          arm,
        })
      );
      if (existingRuns.every((run) => run?.phase === "complete")) {
        continue;
      }
      const completedRuns = await Promise.all(
        evaluationArmOrder.map(async (arm) => {
          const existing = matchingRun({
            receipt: currentReceipt,
            taskId: task.id,
            repeat: repetition,
            arm,
          });
          if (existing && hasGradeableEvidence(existing)) {
            return existing;
          }
          return executeTask({
            prepared: currentReceipt.prepared,
            task,
            repeat: repetition,
            arm,
            call: options.call,
            onProgress: (stage: ExecutionStage) => updateProgress({
              stage,
              taskIndex,
              repeatIndex,
              arm,
            }),
          });
        }),
      );
      for (const run of completedRuns) {
        currentReceipt = replaceRun({ receipt: currentReceipt, run });
      }
      await saveReceipt({ directory: options.directory, receipt: currentReceipt });
      await stopOnFailure(completedRuns);
      const graded = await gradeArms({
        runs: completedRuns,
        task,
        call: options.call,
        directory: options.controlDirectory,
        onVote: (voteIndex) => updateProgress({
          stage: "judging",
          taskIndex,
          repeatIndex,
          arm: null,
          voteIndex,
        }),
      });
      for (const run of graded) {
        currentReceipt = replaceRun({ receipt: currentReceipt, run });
      }

      await saveReceipt({ directory: options.directory, receipt: currentReceipt });
      await stopOnFailure(graded);
    }
  }

  await stopIfExpired();
  currentReceipt = {
    ...currentReceipt,
    status: evaluationStatus(currentReceipt),
  };
  await updateProgress({
    stage: "complete",
    taskIndex: null,
    repeatIndex: null,
    arm: null,
  });
  printReport({ receipt: currentReceipt, json: options.json });
  return currentReceipt;
}
