import { redactSecrets } from "../../redact";
import { installContext } from "./context";
import { prepareDependencies } from "./dependencies";
import { judge } from "./judge";
import { observeRun } from "./observeRun";
import { createSnapshot } from "./snapshot";
import type {
  DelegationTask,
  ModelCall,
  PreparedEval,
  TransferRun,
} from "./types";
import { verifyWorkspace } from "./verify";

export async function executeTask(options: {
  readonly prepared: PreparedEval;
  readonly task: DelegationTask;
  readonly repeat: number;
  readonly arm: "baseline" | "clone";
  readonly call: ModelCall;
  readonly judgeDirectory: string;
}): Promise<TransferRun> {
  const startedAt = Date.now();

  const snapshot = await createSnapshot({
    repository: options.prepared.repository,
    commit: options.task.startingCommit,
  });

  try {
    await prepareDependencies({
      repository: options.prepared.repository,
      directory: snapshot.directory,
    });

    const context = await installContext({
      files: options.prepared.context,
      directory: snapshot.directory,
    });

    const prompt = [
      context,
      "Complete this task within the provided repository. Do not seek external services or modify files outside this repository.",
      options.arm === "clone" ? options.task.profile : "",
      options.task.prompt,
    ]
      .filter(Boolean)
      .join("\n\n");

    const run = await options.call({
      cwd: snapshot.directory,
      prompt,
      execute: true,
    });

    const verification = await verifyWorkspace({
      directory: snapshot.directory,
      timeoutSeconds: options.prepared.timeoutSeconds,
    });

    const observed = await observeRun({
      directory: snapshot.directory,
      run,
      initialCommit: snapshot.initialCommit,
    });

    const evidence = JSON.stringify({
      observed,
      independentVerification: verification,
    });

    const judgedCorrectness = await judge({
      requirements: options.task.completion,
      evidence,
      call: options.call,
      cwd: options.judgeDirectory,
    });

    const correctness = [...verification, ...judgedCorrectness];

    const preferences = await judge({
      requirements: options.task.preferences.map(
        (check) => check.requirement,
      ),
      evidence,
      call: options.call,
      cwd: options.judgeDirectory,
    });

    return {
      taskId: options.task.id,
      repeat: options.repeat,
      arm: options.arm,
      sessionId: run.sessionId,
      failure: null,
      durationMs: run.durationMs,
      costUsd: run.costUsd,
      correctness,
      preferences,
    };
  } catch (error) {
    return {
      taskId: options.task.id,
      repeat: options.repeat,
      arm: options.arm,
      sessionId: null,
      failure: redactSecrets({
        text: error instanceof Error ? error.message : "Evaluation failed",
      }),
      durationMs: Date.now() - startedAt,
      costUsd: null,
      correctness: [],
      preferences: [],
    };
  } finally {
    await snapshot.cleanup();
  }
}
