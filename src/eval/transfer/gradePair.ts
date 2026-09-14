import { redactSecrets } from "../../redact";
import { evaluationArmOrder } from "./arms";
import { judgeCandidate } from "./pairJudge";
import type { DelegationTask, ModelCall, TransferRun } from "./types";

export function hasGradeableEvidence(run: TransferRun): boolean {
  return run.observed !== null && run.dependencyState !== null &&
    run.verification.length > 0 && run.safety.length > 0;
}

export async function gradeArms(options: {
  readonly runs: readonly TransferRun[];
  readonly task: DelegationTask;
  readonly call: ModelCall;
  readonly directory: string;
  readonly onVote: (vote: number) => Promise<void>;
  readonly onRun?: (run: TransferRun) => Promise<void>;
}): Promise<readonly TransferRun[]> {
  const runs = evaluationArmOrder.map((arm) => {
    const run = options.runs.find((candidate) => candidate.arm === arm);
    if (!run || run.observed === null) throw new Error("Evaluation evidence is missing");
    return run;
  });
  return Promise.all(runs.map(async (run) => {
    if (run.phase === "complete" && run.failure === null) return run;
    let current: TransferRun = { ...run, failure: null, failureStage: null };
    try {
      const judgment = await judgeCandidate({
        taskPrompt: options.task.prompt,
        correctness: options.task.completion,
        preferences: options.task.preferences,
        evidence: run.observed ?? "",
        cwd: options.directory,
        call: options.call,
        saved: run.judging,
        onVote: options.onVote,
        onCheckpoint: async (judging) => {
          current = { ...current, judging };
          await options.onRun?.(current);
        },
      });
      current = {
        ...current, phase: "complete",
        correctness: [...run.verification, ...judgment.correctness],
        preferences: judgment.preferences,
      };
    } catch (error) {
      current = {
        ...current,
        failureStage: "judging",
        failure: redactSecrets({ text: error instanceof Error ? error.message : "Evaluation grading failed" }).slice(0, 800),
      };
    }
    await options.onRun?.(current);
    return current;
  }));
}
