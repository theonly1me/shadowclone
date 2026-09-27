import type { GuidanceOptions } from "./runOptions";
import { prepareGuidanceRun } from "./runPreparation";
import { guidanceModelCall } from "./runModel";
import { executeGuidanceCases } from "./runCases";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { redactSecrets } from "../../redact";
import { ownedWrite } from "../../storage";
import { evaluationBudget } from "../transfer/accounting";
import { withEvaluationDeadline } from "../transfer/deadline";
import { lockEvaluation } from "../transfer/lock";
import { disposeSnapshotTemplates } from "../transfer/snapshot";
import { guidanceReport } from "./report";
import type { GuidanceReceipt } from "./schema";
import { guidanceDirectory, saveGuidanceReceipt } from "./store";
import { verifyClaudeContract } from "./claudeContract";
import { recoverSchemaFailure } from "./recovery";
import { runValidation } from "./validation";
import { runMaintenance } from "./maintenance";
import { runComparison } from "./comparison";

export type { GuidanceOptions } from "./runOptions";

export async function runGuidanceEvaluation(
  options: GuidanceOptions,
): Promise<GuidanceReceipt> {
  if (options.comparisonOf) {
    return runComparison({ options, execute: runGuidanceEvaluation });
  }

  if (options.maintenanceOf) {
    return runMaintenance({ options, execute: runGuidanceEvaluation });
  }

  if (options.validationOf) {
    return runValidation({ options, execute: runGuidanceEvaluation });
  }

  const { setup, saved, suite, engine, receipt } =
    await prepareGuidanceRun(options);
  const progress = { receipt };

  const directory = guidanceDirectory({
    paths: setup.paths,
    evalId: progress.receipt.evalId,
  });

  await mkdir(directory, { recursive: true, mode: 0o700 });

  const release = await lockEvaluation(directory);
  const controlDirectory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-guidance-control-"),
  );
  let persistReceipt = saved === null;

  const save = async (): Promise<void> => {
    await saveGuidanceReceipt({
      paths: setup.paths,
      receipt: progress.receipt,
    });
    await ownedWrite({
      path: path.join(directory, "guidance-report.json"),
      content: JSON.stringify(guidanceReport(progress.receipt), null, 2),
    });
  };

  try {
    if (progress.receipt.status === "complete") {
      return progress.receipt;
    }

    if (
      !options.recoverPreflightFailure &&
      progress.receipt.deadlineAt <= Date.now()
    ) {
      throw new Error("Original guidance deadline has expired");
    }

    const proof =
      engine === "claude-code"
        ? await (options.verifyContract ?? verifyClaudeContract)()
        : null;

    if (proof && options.recoverPreflightFailure && options.failedCliVersion) {
      progress.receipt = await recoverSchemaFailure({
        paths: setup.paths,
        receipt: progress.receipt,
        proof,
        failedCliVersion: options.failedCliVersion,
      });
    }

    if (progress.receipt.deadlineAt <= Date.now()) {
      throw new Error("Original guidance deadline has expired");
    }

    if (proof) {
      await ownedWrite({
        path: path.join(directory, "claude-contract.json"),
        content: JSON.stringify(proof, null, 2),
      });
      progress.receipt = { ...progress.receipt, cliVersion: proof.cliVersion };
    }

    const budget = await evaluationBudget({
      directory,
      resume: saved !== null,
      limitUsd: options.maxBudgetUsd,
      maximumCalls: options.maximumCalls,
    });

    persistReceipt = true;

    const call = guidanceModelCall({
      requested: options,
      setup,
      budget,
      engine,
      controlDirectory,
      progress,
    });

    progress.receipt = {
      ...progress.receipt,
      status: "running",
      failure: null,
    };
    await save();
    await withEvaluationDeadline({
      enabled: true,
      durationMs: progress.receipt.deadlineAt - Date.now(),
      operation: () =>
        executeGuidanceCases({
          progress,
          suite,
          pilot: options.pilot,
          engine,
          call,
          controlDirectory,
          save,
        }),
    });
    progress.receipt = { ...progress.receipt, status: "complete" };
  } catch (error) {
    if (!persistReceipt) {
      throw error;
    }

    progress.receipt = {
      ...progress.receipt,
      status: "error",
      failure: redactSecrets({
        text:
          error instanceof Error ? error.message : "Guidance evaluation failed",
      }),
    };
  } finally {
    if (persistReceipt) {
      await save();
    }

    await disposeSnapshotTemplates();
    await rm(controlDirectory, { recursive: true, force: true });
    await release();
  }

  return progress.receipt;
}
