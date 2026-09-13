import { redactSecrets } from "../../redact";
import { evaluationArmOrder, type EvaluationArm } from "./arms";
import { judgeArms } from "./pairJudge";
import type {
  DelegationTask,
  ModelCall,
  TransferRun,
} from "./types";

export function hasGradeableEvidence(run: TransferRun): boolean {
  return run.observed !== null &&
    run.dependencyState !== null &&
    run.verification.length > 0 &&
    run.safety.length > 0;
}

function failedRun(options: {
  readonly run: TransferRun;
  readonly error: unknown;
}): TransferRun {
  return {
    ...options.run,
    failure: redactSecrets({
      text: options.error instanceof Error
        ? options.error.message
        : "Evaluation grading failed",
    }),
  };
}

export async function gradeArms(options: {
  readonly runs: readonly TransferRun[];
  readonly task: DelegationTask;
  readonly call: ModelCall;
  readonly directory: string;
  readonly onVote: (vote: number) => Promise<void>;
}): Promise<readonly TransferRun[]> {
  const byArm = new Map(options.runs.map((run) => [run.arm, run]));
  const evidence: Record<EvaluationArm, string> = {
    bare: "",
    skills: "",
    clone: "",
  };
  for (const arm of evaluationArmOrder) {
    const observed = byArm.get(arm)?.observed;
    if (observed === null || observed === undefined) {
      throw new Error("Evaluation evidence is missing");
    }
    evidence[arm] = observed;
  }
  try {
    const judgments = await judgeArms({
      correctness: options.task.completion,
      preferences: options.task.preferences.map((check) => check.requirement),
      evidence,
      cwd: options.directory,
      call: options.call,
      onVote: options.onVote,
    });
    return evaluationArmOrder.flatMap((arm) => {
      const run = byArm.get(arm);
      return run
        ? [{
            ...run,
            phase: "complete" as const,
            correctness: [...run.verification, ...judgments[arm].correctness],
            preferences: judgments[arm].preferences,
          }]
        : [];
    });
  } catch (error) {
    return options.runs.map((run) => failedRun({ run, error }));
  }
}
