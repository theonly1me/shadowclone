import path from "node:path";
import { ownedWrite } from "../../../storage";
import { evaluationBudget } from "../../transfer/accounting";
import { lockEvaluation } from "../../transfer/lock";
import { setupTransferEval } from "../../transfer/setup";
import { createSnapshot, disposeSnapshotTemplates } from "../../transfer/snapshot";
import { fingerprint } from "../../transfer/structured";
import { verifyClaudeContract } from "../claudeContract";
import { verifyClaudeStreamContract } from "../claudeContract/streamProbe";
import { sourceJudgePromptFingerprint } from "../judgePrompt";
import { validateScenarios } from "../prepare";
import type { GuidanceOptions } from "../run";
import { receiptSchema, type GuidanceReceipt } from "../schema";
import { captureSourceJudging, validateSourceJudging } from "../sourceEvidence";
import { guidanceDirectory, readGuidanceReceipt, readGuidanceSuite, saveGuidanceReceipt } from "../store";
import { maintenanceIdentity, validateMaintenanceDelta } from "./change";
import { maintenanceParent } from "./parent";
import { readMaintenanceManifest, verifyMaintenanceRevision } from "./prepare";
import { maintenanceSchema } from "./schema";

export { prepareMaintenanceSuite } from "./prepare";

export async function runMaintenance(options: { options: GuidanceOptions; execute: (options: GuidanceOptions) => Promise<GuidanceReceipt> }): Promise<GuidanceReceipt> {
  const requested = options.options;
  if (!requested.maintenanceOf || !requested.suiteId || !requested.additionalBudgetUsd || requested.additionalBudgetUsd > 10 || requested.model !== "claude-sonnet-5" ||
    requested.maximumCalls > 48 || requested.deadlineSeconds > 2700 || requested.maxBudgetUsd !== undefined || requested.cumulativeBudgetUsd !== undefined ||
    requested.validationOf || requested.evalId || requested.pilot || requested.scenarioFile || requested.recoverPreflightFailure) throw new Error("Maintenance requires a parent, frozen suite, at most $10 additional, 48 calls and 45 minutes, with exact Sonnet 5");
  const setup = await setupTransferEval({ repo: requested.repo, engine: "claude-code", model: requested.model, reasoningEffort: "medium", paths: requested.paths, runner: requested.runner });
  const { parent, accounting } = await maintenanceParent({ paths: setup.paths, parentEvalId: requested.maintenanceOf });
  if (parent.judging?.version !== 2) throw new Error("Original repository evidence is missing");
  if (parent.model !== requested.model || parent.suite.repository !== setup.repository) throw new Error("Maintenance must retain the original model and repository");
  const suite = await readGuidanceSuite({ paths: setup.paths, suiteId: requested.suiteId });
  const manifest = await readMaintenanceManifest({ paths: setup.paths, suiteId: suite.suiteId });
  if (manifest.parentEvalId !== parent.evalId) throw new Error("Maintenance manifest belongs to a different parent");
  validateMaintenanceDelta({ parent: parent.suite, suite, manifest });
  validateScenarios(suite);
  await verifyMaintenanceRevision({ paths: setup.paths, manifest });
  const maintenance = maintenanceSchema.parse({ version: 1, parentEvalId: parent.evalId, ...accounting, additionalLimitUsd: requested.additionalBudgetUsd, windowSeconds: requested.deadlineSeconds, resolvedModel: "claude-sonnet-5", manifest });
  const evalId = maintenanceIdentity({ parentId: parent.evalId, kind: "evaluation" });
  const directory = guidanceDirectory({ paths: setup.paths, evalId });
  const release = await lockEvaluation(path.join(directory, "maintenance-control"));
  try {
    let receipt: GuidanceReceipt;
    if (await Bun.file(path.join(directory, "guidance-state.json")).exists()) {
      receipt = await readGuidanceReceipt({ paths: setup.paths, evalId });
      if (fingerprint(receipt.maintenance) !== fingerprint(maintenance) || receipt.limitUsd !== requested.additionalBudgetUsd || receipt.maximumCalls !== requested.maximumCalls ||
        receipt.suiteFingerprint !== fingerprint(suite) || receipt.repeat !== 2 || !receipt.pilot || receipt.validation || receipt.model !== requested.model) throw new Error("Maintenance accounting or frozen inputs changed");
      if ((receipt.judging?.version !== 3 && receipt.judging?.version !== 4) || receipt.judging.promptFingerprint !== sourceJudgePromptFingerprint(receipt.judging.version) || receipt.judging.packetFingerprint !== fingerprint(receipt.judging.packet) || receipt.judging.packet.commit !== suite.baseCommit) throw new Error("Maintenance judge contract changed");
      validateSourceJudging({ judging: receipt.judging, suite, repository: parent.judging.packet });
    } else {
      if (await Bun.file(path.join(directory, "budget.json")).exists()) throw new Error("Interrupted maintenance initialization requires an accounting audit");
      const snapshot = await createSnapshot({ repository: suite.repository, commit: suite.baseCommit });
      const judging = await captureSourceJudging({ directory: snapshot.directory, suite }).finally(() => snapshot.cleanup());
      validateSourceJudging({ judging, suite, repository: parent.judging.packet });
      const proof = await (requested.verifyContract ?? verifyClaudeContract)();
      const stream = await (requested.verifyStream ?? verifyClaudeStreamContract)();
      await ownedWrite({ path: path.join(directory, "claude-stream-contract.json"), content: JSON.stringify({ cliVersion: proof.cliVersion, executableFingerprint: proof.executableFingerprint, ...stream }, null, 2) });
      receipt = receiptSchema.parse({ protocol: "guidance-v1", schemaVersion: 1, evalId, suite, suiteFingerprint: fingerprint(suite), maintenance,
        model: requested.model, effort: "medium", cliVersion: proof.cliVersion, judging, pilot: true, repeat: 2, maximumCalls: requested.maximumCalls,
        limitUsd: requested.additionalBudgetUsd, deadlineAt: Date.now() + requested.deadlineSeconds * 1000, status: "ready", failure: null, runs: [] });
      await evaluationBudget({ directory, resume: false, limitUsd: receipt.limitUsd, maximumCalls: receipt.maximumCalls });
      await saveGuidanceReceipt({ paths: setup.paths, receipt });
    }
    return await options.execute({ ...requested, maintenanceOf: undefined, additionalBudgetUsd: undefined, suiteId: undefined,
      maintenanceRun: true, evalId, maxBudgetUsd: requested.additionalBudgetUsd, pilot: true });
  } finally { await disposeSnapshotTemplates(); await release(); }
}
