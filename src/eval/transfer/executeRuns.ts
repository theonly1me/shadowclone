import { evaluationDeadlineError, evaluationSignal, onEvaluationDeadline } from "./deadline";
import { type ExecutionStage, executeTask } from "./execute";
import { evaluationArmOrder } from "./arms";
import { gradeArms, hasGradeableEvidence } from "./gradePair";
import { matchingRun } from "./runRecords";
import { evaluationStatus, printReport } from "./report";
import { receiptRecorder } from "./receiptRecorder";
import type { EvaluationProgress, ModelCall, TransferReceipt, TransferRun } from "./types";

export async function executeTransferRuns(options: {
  readonly receipt: TransferReceipt;
  readonly directory: string;
  readonly controlDirectory: string;
  readonly call: ModelCall;
  readonly json: boolean;
  readonly startedAt: number;
  readonly onProgress?: (progress: EvaluationProgress) => void;
}): Promise<TransferReceipt> {
  const recorder = receiptRecorder(options);
  const expired = () => {
    if (evaluationSignal()?.aborted) throw evaluationDeadlineError();
  };
  const checkRuns = (runs: readonly TransferRun[]) => {
    expired();
    if (runs.some((run) => run.failure !== null)) {
      throw new Error("Evaluation infrastructure failed");
    }
  };
  const unregister = onEvaluationDeadline(() => recorder.fail({
    stage: "timeout", message: evaluationDeadlineError().message,
  }));
  try {
    for (const [taskOffset, task] of recorder.current.prepared.tasks.entries()) {
      expired();
      for (let repetition = 0; repetition < recorder.current.prepared.repeat; repetition += 1) {
        expired();
        const taskIndex = taskOffset + 1;
        const repeatIndex = repetition + 1;
        const existing = (arm: (typeof evaluationArmOrder)[number]) => matchingRun({
          receipt: recorder.current, taskId: task.id, repeat: repetition, arm,
        });
        if (evaluationArmOrder.every((arm) => existing(arm)?.phase === "complete")) continue;
        const completedRuns = await Promise.all(evaluationArmOrder.map(async (arm) => {
          const saved = existing(arm);
          if (saved && hasGradeableEvidence(saved)) {
            return saved.failureStage === "judging" ? { ...saved, failure: null, failureStage: null } : saved;
          }
          const run = await executeTask({
            prepared: recorder.current.prepared, task, repeat: repetition, arm, call: options.call,
            onProgress: (stage: ExecutionStage) => recorder.progress({ stage, taskIndex, repeatIndex, arm }),
          });
          await recorder.run(run);
          return run;
        }));
        checkRuns(completedRuns);
        const graded = await gradeArms({
          runs: completedRuns, task, call: options.call, directory: options.controlDirectory,
          onRun: (run) => recorder.run(run),
          onVote: (voteIndex) => recorder.progress({
            stage: "judging", taskIndex, repeatIndex, arm: null, voteIndex,
          }),
        });
        checkRuns(graded);
      }
    }
    expired();
    await recorder.complete(evaluationStatus(recorder.current));
    printReport({ receipt: recorder.current, json: options.json });
    return recorder.current;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Evaluation failed";
    await recorder.fail({ stage: evaluationSignal()?.aborted ? "timeout" : "error", message });
    printReport({ receipt: recorder.current, json: options.json });
    throw new Error(`${message}. Resume with --eval-id ${recorder.current.evalId}`);
  } finally {
    unregister();
  }
}
