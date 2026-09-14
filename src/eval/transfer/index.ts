import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { invocationCeiling } from "./budget";
import { modelCaller } from "./call";
import { evaluationBudget } from "./accounting";
import { lockEvaluation } from "./lock";
import { throwIfEvaluationExpired, withEvaluationDeadline } from "./deadline";
import { executeTransferRuns } from "./executeRuns";
import { prepareEvaluation } from "./prepare";
import { stepLine } from "./progress";
import { setupTransferEval } from "./setup";
import { disposeSnapshotTemplates } from "./snapshot";
import { initialReceipt, saveReceipt } from "./storage";
import type {
  TransferOptions,
  TransferReceipt,
} from "./types";

export {
  defaultRepeat,
  defaultTaskCount,
  defaultTimeoutSeconds,
  invocationCeiling,
} from "./budget";
export {
  type DependencyMode,
  dependencyModes,
  type TransferOptions,
  type TransferReceipt,
} from "./types";

export async function runTransferEval(
  transferOptions: TransferOptions = {},
): Promise<TransferReceipt> {
  const startedAt = Date.now();
  const possibleSingleAttempt = transferOptions.evalId !== undefined ||
    (transferOptions.tasks === 1 || transferOptions.task !== undefined) &&
      transferOptions.repeat === 1;
  return withEvaluationDeadline({
    enabled: possibleSingleAttempt || transferOptions.deadlineSeconds !== undefined,
    ...(transferOptions.deadlineSeconds === undefined
      ? {}
      : { durationMs: transferOptions.deadlineSeconds * 1_000 }),
    operation: async ({ disable }) => {
      const setup = await setupTransferEval(transferOptions);
      if ((setup.count !== 1 || setup.repeat !== 1) && transferOptions.deadlineSeconds === undefined) {
        disable();
      }
      throwIfEvaluationExpired();
      const onStep = (message: string): void => {
        if (!(transferOptions.json ?? false)) {
          console.log(stepLine({ message, startedAt }));
        }
      };
      const controlDirectory = await mkdtemp(
        path.join(os.tmpdir(), "shadowclone-eval-control-"),
      );
      let releaseLock: (() => Promise<void>) | undefined;
      try {
        releaseLock = await lockEvaluation(setup.directory);
        const callBudget = await evaluationBudget({
          directory: setup.directory,
          resume: setup.saved !== null,
          limitUsd: setup.maxBudgetUsd,
          maximumCalls: invocationCeiling({
            tasks: setup.count,
            repeat: setup.repeat,
          }),
        });
        const call = modelCaller({
          budget: callBudget,
          runner: setup.runner,
          engine: setup.engine,
          model: setup.model,
          reasoningEffort: setup.reasoningEffort,
          timeoutSeconds: setup.timeoutSeconds,
          maxBudgetUsd: setup.maxBudgetUsd,
          blockedPaths: [setup.repository, setup.paths.shadowcloneDirectory],
          controlDirectory,
        });
        const receipt = setup.saved ?? initialReceipt(
          await prepareEvaluation({
            setup,
            call,
            json: transferOptions.json ?? false,
            onStep,
          }),
        );
        throwIfEvaluationExpired();
        await saveReceipt({ directory: setup.directory, receipt });
        onStep(`Evaluation ${receipt.evalId} is ready`);
        return await executeTransferRuns({
          receipt,
          directory: setup.directory,
          controlDirectory,
          call,
          json: transferOptions.json ?? false,
          startedAt,
        });
      } finally {
        try {
          await Promise.all([
            rm(controlDirectory, { recursive: true, force: true }),
            disposeSnapshotTemplates(),
          ]);
        } finally {
          await releaseLock?.();
        }
      }
    },
  });
}
