import path from "node:path";
import { ownedWrite } from "../../../storage";
import { evaluationBudget } from "../../transfer/accounting";
import { lockEvaluation } from "../../transfer/lock";
import { setupTransferEval } from "../../transfer/setup";
import { createSnapshot, disposeSnapshotTemplates } from "../../transfer/snapshot";
import { fingerprint } from "../../transfer/structured";
import { verifyClaudeContract } from "../claudeContract";
import { verifyClaudeStreamContract } from "../claudeContract/streamProbe";
import { validateScenarios } from "../prepare";
import type { GuidanceOptions } from "../run";
import { receiptSchema, type GuidanceReceipt } from "../schema";
import { guidanceDirectory, readGuidanceReceipt, saveGuidanceReceipt } from "../store";
import { comparisonParent } from "./parent";
import { comparisonSchema } from "./schema";

export function comparisonIdentity(parentId: string): string {
  const hash = fingerprint({ purpose: "guidance-four-case-comparison-v1", parentId });
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-8${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export async function runComparison(options: { options: GuidanceOptions; execute: (options: GuidanceOptions) => Promise<GuidanceReceipt> }): Promise<GuidanceReceipt> {
  const requested = options.options;
  if (!requested.comparisonOf || !requested.additionalBudgetUsd || requested.additionalBudgetUsd > 20 || requested.model !== "claude-sonnet-5" ||
    requested.maximumCalls > 96 || requested.deadlineSeconds > 5400 || requested.maxBudgetUsd !== undefined || requested.cumulativeBudgetUsd !== undefined ||
    requested.maintenanceOf || requested.validationOf || requested.evalId || requested.suiteId || requested.pilot || requested.scenarioFile ||
    requested.memorySource || requested.memoryManifest || requested.recoverPreflightFailure) throw new Error("Comparison requires only a maintenance parent, at most $20 additional, 96 calls and 90 minutes, with exact Sonnet 5");
  const setup = await setupTransferEval({ repo: requested.repo, engine: "claude-code", model: requested.model, reasoningEffort: "medium", paths: requested.paths, runner: requested.runner });
  const { parent, judging, accounting } = await comparisonParent({ paths: setup.paths, parentEvalId: requested.comparisonOf });
  if (parent.suite.repository !== setup.repository) throw new Error("Comparison must retain the original repository");
  validateScenarios(parent.suite);
  const comparison = comparisonSchema.parse({ version: 1, parentEvalId: parent.evalId, ...accounting, additionalLimitUsd: requested.additionalBudgetUsd,
    windowSeconds: requested.deadlineSeconds, resolvedModel: "claude-sonnet-5" });
  const evalId = comparisonIdentity(parent.evalId);
  const directory = guidanceDirectory({ paths: setup.paths, evalId });
  const release = await lockEvaluation(path.join(directory, "comparison-control"));
  try {
    let receipt: GuidanceReceipt;
    if (await Bun.file(path.join(directory, "guidance-state.json")).exists()) {
      receipt = await readGuidanceReceipt({ paths: setup.paths, evalId });
      if (fingerprint(receipt.comparison) !== fingerprint(comparison) || receipt.limitUsd !== requested.additionalBudgetUsd || receipt.maximumCalls !== requested.maximumCalls ||
        receipt.suiteFingerprint !== parent.suiteFingerprint || receipt.repeat !== 2 || receipt.pilot || receipt.validation || receipt.maintenance ||
        receipt.model !== requested.model || fingerprint(receipt.judging) !== fingerprint(judging)) throw new Error("Comparison accounting, frozen inputs, or judge contract changed");
    } else {
      if (await Bun.file(path.join(directory, "budget.json")).exists()) throw new Error("Interrupted comparison initialization requires an accounting audit");
      const snapshot = await createSnapshot({ repository: parent.suite.repository, commit: parent.suite.baseCommit });
      await snapshot.cleanup();
      const proof = await (requested.verifyContract ?? verifyClaudeContract)();
      const stream = await (requested.verifyStream ?? verifyClaudeStreamContract)();
      await ownedWrite({ path: path.join(directory, "claude-stream-contract.json"), content: JSON.stringify({ cliVersion: proof.cliVersion, executableFingerprint: proof.executableFingerprint, ...stream }, null, 2) });
      receipt = receiptSchema.parse({ protocol: "guidance-v1", schemaVersion: 1, evalId, suite: parent.suite, suiteFingerprint: parent.suiteFingerprint, comparison,
        model: requested.model, effort: "medium", cliVersion: proof.cliVersion, judging, pilot: false, repeat: 2, maximumCalls: requested.maximumCalls,
        limitUsd: requested.additionalBudgetUsd, deadlineAt: Date.now() + requested.deadlineSeconds * 1000, status: "ready", failure: null, runs: [] });
      await evaluationBudget({ directory, resume: false, limitUsd: receipt.limitUsd, maximumCalls: receipt.maximumCalls });
      await saveGuidanceReceipt({ paths: setup.paths, receipt });
    }
    return await options.execute({ ...requested, comparisonOf: undefined, additionalBudgetUsd: undefined, comparisonRun: true, evalId, maxBudgetUsd: requested.additionalBudgetUsd });
  } finally { await disposeSnapshotTemplates(); await release(); }
}
