import path from "node:path";
import { readBoundedFile } from "../../../io/files";
import type { ProjectPaths } from "../../../paths";
import { budgetSchema } from "../../transfer/accounting";
import { fingerprint } from "../../transfer/structured";
import {
  guidanceDirectory,
  readGuidanceReceipt,
  readGuidanceSuite,
} from "../store";
import type { GuidanceReceipt } from "../schema";

async function readBudget(options: {
  readonly paths: ProjectPaths;
  readonly receipt: GuidanceReceipt;
}) {
  const directory = guidanceDirectory({
    paths: options.paths,
    evalId: options.receipt.evalId,
  });
  const text = await readBoundedFile({
    filePath: path.join(directory, "budget.json"),
    roots: [directory],
    maximumBytes: 4096,
  });

  if (!text) {
    throw new Error("Historical evaluation budget is missing");
  }

  const budget = budgetSchema.parse(JSON.parse(text));

  if (
    budget.pending ||
    budget.unknownCost ||
    budget.limitUsd !== options.receipt.limitUsd ||
    budget.maximumCalls !== options.receipt.maximumCalls
  ) {
    throw new Error("Historical accounting is unresolved or changed");
  }

  return budget;
}

export async function maintenanceParent(options: {
  readonly paths: ProjectPaths;
  readonly parentEvalId: string;
}) {
  const parent = await readGuidanceReceipt({
    paths: options.paths,
    evalId: options.parentEvalId,
  });

  if (
    parent.status !== "complete" ||
    !parent.validation ||
    parent.maintenance ||
    parent.repeat !== 2 ||
    !parent.pilot ||
    parent.runs.length !== 16 ||
    parent.runs.some(
      (run) =>
        !run.complete ||
        run.votes.length !== 2 ||
        run.resolvedModel !== "claude-sonnet-5",
    )
  ) {
    throw new Error("Maintenance requires a completed measurement validation");
  }

  if (
    fingerprint(
      await readGuidanceSuite({
        paths: options.paths,
        suiteId: parent.suite.suiteId,
      }),
    ) !== parent.suiteFingerprint
  ) {
    throw new Error("Original frozen suite changed");
  }

  const original = await readGuidanceReceipt({
    paths: options.paths,
    evalId: parent.validation.parentEvalId,
  });
  const originalBudget = await readBudget({
    paths: options.paths,
    receipt: original,
  });
  const parentBudget = await readBudget({
    paths: options.paths,
    receipt: parent,
  });

  if (
    original.status !== "complete" ||
    fingerprint(original) !== parent.validation.parentReceiptFingerprint ||
    fingerprint(originalBudget) !== parent.validation.parentBudgetFingerprint ||
    original.suiteFingerprint !== parent.suiteFingerprint ||
    parent.validation.priorSpentUsd !== originalBudget.spentUsd ||
    parent.validation.priorCalls !== originalBudget.calls ||
    parent.validation.resolvedModel !== "claude-sonnet-5"
  ) {
    throw new Error("Original pilot accounting or frozen evidence changed");
  }

  return {
    parent,
    accounting: {
      parentReceiptFingerprint: fingerprint(parent),
      parentBudgetFingerprint: fingerprint(parentBudget),
      originalReceiptFingerprint: fingerprint(original),
      originalBudgetFingerprint: fingerprint(originalBudget),
      priorSpentUsd: originalBudget.spentUsd + parentBudget.spentUsd,
      priorCalls: originalBudget.calls + parentBudget.calls,
    },
  };
}
