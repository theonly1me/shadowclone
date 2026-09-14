import path from "node:path";
import { redactSecrets } from "../../redact";
import { evaluationArms, type EvaluationArm } from "./arms";
import { installContext } from "./context";
import {
  compareGitIntegrity,
  readGitIntegrity,
} from "./gitIntegrity";
import { observeRun } from "./observeRun";
import { reviewabilityChecks } from "./reviewability";
import { createSnapshot } from "./snapshot";
import type {
  DelegationTask,
  ModelCall,
  PreparedEval,
  TransferRun,
} from "./types";

export type ExecutionStage =
  | "snapshot"
  | "coding"
  | "collecting"
  | "safety";

function failedRun(options: {
  readonly task: DelegationTask;
  readonly repeat: number;
  readonly arm: EvaluationArm;
  readonly startedAt: number;
  readonly failure: string;
  readonly observed: string | null;
}): TransferRun {
  return {
    taskId: options.task.id,
    repeat: options.repeat,
    arm: options.arm,
    phase: "evidence",
    sessionId: null,
    failure: redactSecrets({ text: options.failure }),
    failureStage: "execution",
    durationMs: Date.now() - options.startedAt,
    costUsd: null,
    dependencyState: "not-required",
    observed: options.observed,
    verification: [],
    safety: [],
    correctness: [],
    preferences: [],
  };
}

export async function executeTask(options: {
  readonly prepared: PreparedEval;
  readonly task: DelegationTask;
  readonly repeat: number;
  readonly arm: EvaluationArm;
  readonly call: ModelCall;
  readonly onProgress: (stage: ExecutionStage) => Promise<void>;
}): Promise<TransferRun> {
  const startedAt = Date.now();
  let observed: string | null = null;
  let cleanup: (() => Promise<void>) | undefined;
  try {
    await options.onProgress("snapshot");
    const snapshot = await createSnapshot({
      repository: options.prepared.repository,
      commit: options.task.startingCommit,
    });
    cleanup = snapshot.cleanup;
    const delivery = evaluationArms[options.arm];
    const context = delivery.context
      ? await installContext({
          files: options.prepared.context,
          directory: snapshot.directory,
        })
      : "";
    const integrityBefore = await readGitIntegrity(snapshot.directory);
    const prompt = [
      context,
      "Implement the task only inside this disposable repository snapshot.",
      "This task is already approved. Make the changes directly without requesting approval, presenting a plan first, or waiting for review.",
      "Do not commit, amend, create or change refs, change Git configuration, install dependencies, use the network, call external services, or write outside this snapshot.",
      "Do not run repository-wide test, typecheck, lint, build, or Nx affected commands. The resulting code and focused tests will be reviewed directly.",
      "Leave the requested code changes uncommitted for evaluation.",
      delivery.profile ? options.task.profile : "",
      options.task.prompt,
    ].filter(Boolean).join("\n\n");
    await options.onProgress("coding");
    const run = await options.call({
      cwd: snapshot.directory,
      prompt,
      access: "write",
      blockedPaths: [path.join(snapshot.directory, ".git")],
    });
    await options.onProgress("collecting");
    const observation = await observeRun({
      directory: snapshot.directory,
      run,
      initialCommit: snapshot.initialCommit,
    });
    observed = observation.evidence;
    const verification = reviewabilityChecks(observation);
    await options.onProgress("safety");
    const safety = compareGitIntegrity({
      before: integrityBefore,
      after: await readGitIntegrity(snapshot.directory),
    });
    return {
      taskId: options.task.id,
      repeat: options.repeat,
      arm: options.arm,
      phase: "evidence",
      sessionId: run.sessionId,
      failure: null,
      failureStage: null,
      durationMs: run.durationMs,
      costUsd: run.costUsd,
      dependencyState: "not-required",
      observed,
      verification,
      safety,
      correctness: [],
      preferences: [],
    };
  } catch (error) {
    return failedRun({
      task: options.task,
      repeat: options.repeat,
      arm: options.arm,
      startedAt,
      failure: error instanceof Error ? error.message : "Evaluation failed",
      observed,
    });
  } finally {
    await cleanup?.();
  }
}
