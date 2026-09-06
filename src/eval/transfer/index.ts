import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { openEventIndex } from "../../index";
import { invocationCeiling } from "./budget";
import { modelCaller } from "./call";
import { command } from "./command";
import { captureContext } from "./context";
import { collectEvidence } from "./evidence";
import { executeTransferRuns } from "./executeRuns";
import { prepareTasks } from "./prepare";
import { learnEvaluationProfile } from "./profile";
import { setupTransferEval } from "./setup";
import { initialReceipt, saveReceipt } from "./storage";
import type { TransferOptions, TransferReceipt } from "./types";

export type { TransferOptions, TransferReceipt } from "./types";
export {
  defaultRepeat,
  defaultTaskCount,
  defaultTimeoutSeconds,
  invocationCeiling,
} from "./budget";

export async function runTransferEval(
  options: TransferOptions = {},
): Promise<TransferReceipt> {
  const setup = await setupTransferEval(options);

  const controlDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-eval-control-"),
  );

  try {
    const call = modelCaller({
      runner: setup.runner,
      engine: setup.engine,
      model: setup.model,
      timeoutSeconds: setup.timeoutSeconds,
      maxBudgetUsd: setup.maxBudgetUsd,
      blockedPaths: [setup.repository, setup.paths.shadowcloneDirectory],
      controlDirectory,
      maximumCalls: invocationCeiling({
        tasks: setup.count,
        repeat: setup.repeat,
      }),
    });

    let receipt: TransferReceipt;

    if (setup.saved) {
      receipt = setup.saved;

      if (
        receipt.prepared.repository !== setup.repository ||
        receipt.prepared.engine !== setup.engine ||
        receipt.prepared.model !== setup.model ||
        receipt.prepared.repeat !== setup.repeat ||
        receipt.prepared.timeoutSeconds !== setup.timeoutSeconds
      ) {
        throw new Error(
          "Rerun repository, engine and model must match the frozen evaluation",
        );
      }
    } else {
      const index = await openEventIndex(setup.paths.indexDatabase);
      const events = index.listEvents();
      index.close();

      const evidence = await collectEvidence({
        events,
        repository: setup.repository,
        config: setup.config,
      });

      const revListOutput = await command({
        arguments: ["git", "rev-list", "--all"],
        cwd: setup.repository,
      });
      const commits = new Set(revListOutput.split("\n"));

      const context = await captureContext({
        enabled: setup.config.sources["agent-context"],
        home: os.homedir(),
        repository: setup.repository,
        engine: setup.engine,
      });

      const prepared = await prepareTasks({
        evidence,
        commits,
        count: setup.count,
        since: setup.since,
        call,
        cwd: controlDirectory,
        resolveCommit: async ({ timestamp }) => {
          try {
            const hash = await command({
              arguments: [
                "git",
                "log",
                "-n",
                "1",
                `--before=${new Date(timestamp).toISOString()}`,
                "--format=%H",
              ],
              cwd: setup.repository,
            });
            return hash.trim() || null;
          } catch {
            return null;
          }
        },
        learnProfile: (training) =>
          learnEvaluationProfile({
            ...training,
            events,
            call,
            directory: controlDirectory,
          }),
      });

      receipt = initialReceipt({
        schemaVersion: 2,
        evalId: setup.evalId,
        repository: setup.repository,
        engine: setup.engine,
        model: setup.model,
        repeat: setup.repeat,
        timeoutSeconds: setup.timeoutSeconds,
        context,
        maxBudgetUsd: setup.maxBudgetUsd ?? null,
        ...prepared,
      });
    }

    await saveReceipt({ directory: setup.directory, receipt });

    return await executeTransferRuns({
      receipt,
      directory: setup.directory,
      controlDirectory,
      call,
      json: options.json ?? false,
    });
  } finally {
    await rm(controlDirectory, { recursive: true, force: true });
  }
}
