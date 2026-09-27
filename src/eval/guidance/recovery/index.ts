import path from "node:path";
import { readBoundedFile } from "../../../io/files";
import type { ProjectPaths } from "../../../paths";
import { ownedWrite } from "../../../storage";
import { budgetSchema } from "../../transfer/accounting";
import { fingerprint } from "../../transfer/structured";
import {
  contractProofSchema,
  type ClaudeContractProof,
} from "../claudeContract";
import type { GuidanceReceipt } from "../schema";
import { guidanceDirectory, saveGuidanceReceipt } from "../store";
import { recoverySchema, type SchemaRecovery } from "./schema";
import {
  unchangedRecoveryInputs,
  validateRecoverableFailure,
  validateRecoveryProof,
} from "./validate";

export async function recoverSchemaFailure(options: {
  readonly paths: ProjectPaths;
  readonly receipt: GuidanceReceipt;
  readonly proof: ClaudeContractProof;
  readonly failedCliVersion: string;
}): Promise<GuidanceReceipt> {
  const proof = contractProofSchema.parse(options.proof);

  validateRecoveryProof({ proof, failedCliVersion: options.failedCliVersion });

  const directory = guidanceDirectory({
    paths: options.paths,
    evalId: options.receipt.evalId,
  });

  const read = (name: string) =>
    readBoundedFile({
      filePath: path.join(directory, name),
      roots: [directory],
      maximumBytes: 64 * 1024 * 1024,
    });

  const budgetText = await read("budget.json");

  if (budgetText === null) {
    throw new Error("Recovery requires the original budget ledger");
  }

  const currentBudget = budgetSchema.parse(JSON.parse(budgetText));
  const saved = await read("schema-recovery.json");
  let recovery: SchemaRecovery;

  if (saved === null) {
    validateRecoverableFailure({
      receipt: options.receipt,
      budget: currentBudget,
      failedCliVersion: options.failedCliVersion,
    });
    recovery = recoverySchema.parse({
      version: 1,
      reason: "verified-local-schema-rejection",
      recoveredCostUsd: 0,
      originalReceipt: options.receipt,
      originalBudget: currentBudget,
      originalReceiptFingerprint: fingerprint(options.receipt),
      originalBudgetFingerprint: fingerprint(currentBudget),
      failedCliVersion: options.failedCliVersion,
      proof,
      deadlineAt: Date.now() + 25 * 60 * 1000,
    });
    await ownedWrite({
      path: path.join(directory, "schema-recovery.json"),
      content: JSON.stringify(recovery, null, 2),
    });
  } else {
    recovery = recoverySchema.parse(JSON.parse(saved));

    if (
      fingerprint(recovery.originalReceipt) !==
        recovery.originalReceiptFingerprint ||
      fingerprint(recovery.originalBudget) !==
        recovery.originalBudgetFingerprint ||
      recovery.failedCliVersion !== options.failedCliVersion ||
      recovery.proof.executableFingerprint !== proof.executableFingerprint ||
      !unchangedRecoveryInputs({
        original: recovery.originalReceipt,
        current: options.receipt,
      })
    ) {
      throw new Error("Recovery audit or frozen inputs changed");
    }

    validateRecoverableFailure({
      receipt: recovery.originalReceipt,
      budget: recovery.originalBudget,
      failedCliVersion: options.failedCliVersion,
    });
  }

  const restoredBudget = { ...recovery.originalBudget, unknownCost: false };

  const restoredReceipt: GuidanceReceipt = {
    ...recovery.originalReceipt,
    cliVersion: proof.cliVersion,
    status: "ready",
    failure: null,
    deadlineAt: recovery.deadlineAt,
  };

  if (options.receipt.deadlineAt === recovery.deadlineAt) {
    if (
      currentBudget.calls < restoredBudget.calls ||
      currentBudget.spentUsd < restoredBudget.spentUsd ||
      currentBudget.limitUsd !== restoredBudget.limitUsd ||
      currentBudget.maximumCalls !== restoredBudget.maximumCalls
    ) {
      throw new Error("Recovered accounting was altered");
    }

    return options.receipt;
  }

  if (fingerprint(options.receipt) !== recovery.originalReceiptFingerprint) {
    throw new Error("Original receipt changed before recovery completed");
  }

  if (fingerprint(currentBudget) === recovery.originalBudgetFingerprint) {
    await ownedWrite({
      path: path.join(directory, "budget.json"),
      content: JSON.stringify(restoredBudget),
    });
  } else if (fingerprint(currentBudget) !== fingerprint(restoredBudget)) {
    throw new Error("Budget changed before recovery completed");
  }

  await saveGuidanceReceipt({ paths: options.paths, receipt: restoredReceipt });

  return restoredReceipt;
}
