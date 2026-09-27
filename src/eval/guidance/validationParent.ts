import path from "node:path";
import { readBoundedFile } from "../../io/files";
import { budgetSchema } from "../transfer/accounting";
import { setupTransferEval } from "../transfer/setup";
import { fingerprint } from "../transfer/structured";
import type { GuidanceOptions } from "./run";
import {
  guidanceDirectory,
  readGuidanceReceipt,
  readGuidanceSuite,
} from "./store";
import { validationSchema } from "./validationSchema";

export async function loadValidationParent(requested: GuidanceOptions) {
  if (
    !requested.validationOf ||
    !requested.cumulativeBudgetUsd ||
    requested.maxBudgetUsd !== undefined ||
    requested.pilot ||
    requested.evalId ||
    requested.suiteId ||
    requested.scenarioFile ||
    requested.recoverPreflightFailure
  ) {
    throw new Error(
      "Validation requires only --validation-of and --cumulative-budget-usd",
    );
  }

  if (requested.maximumCalls > 48 || requested.deadlineSeconds > 2700) {
    throw new Error("Validation permits at most 48 calls and 45 minutes");
  }

  const setup = await setupTransferEval({
    repo: requested.repo,
    engine: "claude-code",
    model: requested.model,
    reasoningEffort: "medium",
    paths: requested.paths,
    runner: requested.runner,
  });

  const parent = await readGuidanceReceipt({
    paths: setup.paths,
    evalId: requested.validationOf,
  });

  if (
    parent.status !== "complete" ||
    !parent.pilot ||
    parent.repeat !== 1 ||
    parent.validation ||
    parent.runs.length !== 8 ||
    parent.runs.some((run) => !run.complete || run.votes.length !== 2)
  ) {
    throw new Error("Validation requires a completed original pilot");
  }

  if (
    parent.model !== requested.model ||
    parent.suite.repository !== setup.repository
  ) {
    throw new Error("Validation must retain the original repository and model");
  }

  if (
    fingerprint(
      await readGuidanceSuite({
        paths: setup.paths,
        suiteId: parent.suite.suiteId,
      }),
    ) !== parent.suiteFingerprint
  ) {
    throw new Error("Original frozen suite changed");
  }

  const parentDirectory = guidanceDirectory({
    paths: setup.paths,
    evalId: parent.evalId,
  });
  const budgetText = await readBoundedFile({
    filePath: path.join(parentDirectory, "budget.json"),
    roots: [parentDirectory],
    maximumBytes: 4096,
  });

  if (!budgetText) {
    throw new Error("Original pilot budget is missing");
  }

  const parentBudget = budgetSchema.parse(JSON.parse(budgetText));

  if (parentBudget.pending || parentBudget.unknownCost) {
    throw new Error("Original pilot cost is unresolved");
  }

  const [resolvedModel] = [
    ...new Set(parent.runs.map((run) => run.resolvedModel)),
  ];

  if (
    !resolvedModel ||
    parent.runs.some((run) => run.resolvedModel !== resolvedModel)
  ) {
    throw new Error("Original pilot model is inconsistent");
  }

  const validation = validationSchema.parse({
    parentEvalId: parent.evalId,
    parentReceiptFingerprint: fingerprint(parent),
    parentBudgetFingerprint: fingerprint(parentBudget),
    priorSpentUsd: parentBudget.spentUsd,
    priorCalls: parentBudget.calls,
    cumulativeLimitUsd: requested.cumulativeBudgetUsd,
    resolvedModel,
  });

  const limitUsd = validation.cumulativeLimitUsd - validation.priorSpentUsd;

  if (limitUsd <= 0) {
    throw new Error("Cumulative validation budget exhausted");
  }

  return { setup, parent, validation, limitUsd };
}
