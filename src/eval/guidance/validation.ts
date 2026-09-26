import path from "node:path";
import { readBoundedFile } from "../../io/files";
import { ownedWrite } from "../../storage";
import { budgetSchema, evaluationBudget } from "../transfer/accounting";
import { lockEvaluation } from "../transfer/lock";
import { setupTransferEval } from "../transfer/setup";
import { createSnapshot, disposeSnapshotTemplates } from "../transfer/snapshot";
import { fingerprint } from "../transfer/structured";
import { captureJudgePacket, validateJudgePacket, type JudgePacket } from "./judgeEvidence";
import { judgePromptFingerprint } from "./judgePrompt";
import type { GuidanceOptions } from "./run";
import { receiptSchema, type GuidanceReceipt } from "./schema";
import { guidanceDirectory, readGuidanceReceipt, readGuidanceSuite, saveGuidanceReceipt } from "./store";
import { validationSchema } from "./validationSchema";
import { verifyClaudeContract } from "./claudeContract";
import { verifyClaudeStreamContract } from "./claudeContract/streamProbe";

export function validationId(parentId: string): string {
  const hash = fingerprint({ purpose: "guidance-measurement-validation-v2", parentId });
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-8${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export async function runValidation(options: {
  options: GuidanceOptions;
  execute: (options: GuidanceOptions) => Promise<GuidanceReceipt>;
}): Promise<GuidanceReceipt> {
  const requested = options.options;
  if (!requested.validationOf || !requested.cumulativeBudgetUsd || requested.maxBudgetUsd !== undefined || requested.pilot || requested.evalId || requested.suiteId || requested.scenarioFile || requested.recoverPreflightFailure) throw new Error("Validation requires only --validation-of and --cumulative-budget-usd");
  if (requested.maximumCalls > 48 || requested.deadlineSeconds > 2700) throw new Error("Validation permits at most 48 calls and 45 minutes");
  const setup = await setupTransferEval({ repo: requested.repo, engine: "claude-code", model: requested.model, reasoningEffort: "medium", paths: requested.paths, runner: requested.runner });
  const parent = await readGuidanceReceipt({ paths: setup.paths, evalId: requested.validationOf });
  if (parent.status !== "complete" || !parent.pilot || parent.repeat !== 1 || parent.validation || parent.runs.length !== 8 || parent.runs.some((run) => !run.complete || run.votes.length !== 2)) throw new Error("Validation requires a completed original pilot");
  if (parent.model !== requested.model || parent.suite.repository !== setup.repository) throw new Error("Validation must retain the original repository and model");
  if (fingerprint(await readGuidanceSuite({ paths: setup.paths, suiteId: parent.suite.suiteId })) !== parent.suiteFingerprint) throw new Error("Original frozen suite changed");
  const parentDirectory = guidanceDirectory({ paths: setup.paths, evalId: parent.evalId });
  const budgetText = await readBoundedFile({ filePath: path.join(parentDirectory, "budget.json"), roots: [parentDirectory], maximumBytes: 4096 });
  if (!budgetText) throw new Error("Original pilot budget is missing");
  const parentBudget = budgetSchema.parse(JSON.parse(budgetText));
  if (parentBudget.pending || parentBudget.unknownCost) throw new Error("Original pilot cost is unresolved");
  const [resolvedModel] = [...new Set(parent.runs.map((run) => run.resolvedModel))];
  if (!resolvedModel || parent.runs.some((run) => run.resolvedModel !== resolvedModel)) throw new Error("Original pilot model is inconsistent");
  const validation = validationSchema.parse({ parentEvalId: parent.evalId, parentReceiptFingerprint: fingerprint(parent), parentBudgetFingerprint: fingerprint(parentBudget),
    priorSpentUsd: parentBudget.spentUsd, priorCalls: parentBudget.calls, cumulativeLimitUsd: requested.cumulativeBudgetUsd, resolvedModel });
  const limitUsd = validation.cumulativeLimitUsd - validation.priorSpentUsd;
  if (limitUsd <= 0) throw new Error("Cumulative validation budget exhausted");
  const evalId = validationId(parent.evalId);
  const directory = guidanceDirectory({ paths: setup.paths, evalId });
  const release = await lockEvaluation(path.join(directory, "validation-control"));
  try {
    const exists = await Bun.file(path.join(directory, "guidance-state.json")).exists();
    let receipt: GuidanceReceipt;
    if (exists) {
      receipt = await readGuidanceReceipt({ paths: setup.paths, evalId });
      if (fingerprint(receipt.validation) !== fingerprint(validation) || receipt.limitUsd !== limitUsd || receipt.maximumCalls !== requested.maximumCalls || receipt.repeat !== 2 || !receipt.pilot || receipt.suiteFingerprint !== parent.suiteFingerprint) throw new Error("Validation accounting or frozen inputs changed");
      if (receipt.judging?.version !== 2 || receipt.judging.promptFingerprint !== judgePromptFingerprint() || receipt.judging.packetFingerprint !== fingerprint(receipt.judging.packet) || receipt.judging.packet.commit !== receipt.suite.baseCommit) throw new Error("Validation judge contract changed");
      validateJudgePacket(receipt.judging.packet);
    } else {
      if (await Bun.file(path.join(directory, "budget.json")).exists()) throw new Error("Interrupted validation initialization requires an accounting audit");
      const snapshot = await createSnapshot({ repository: parent.suite.repository, commit: parent.suite.baseCommit });
      let packet: JudgePacket;
      try { packet = await captureJudgePacket({ directory: snapshot.directory, commit: parent.suite.baseCommit }); }
      finally { await snapshot.cleanup(); }
      const proof = await (requested.verifyContract ?? verifyClaudeContract)();
      const streamProof = await (requested.verifyStream ?? verifyClaudeStreamContract)();
      await ownedWrite({ path: path.join(directory, "claude-stream-contract.json"), content: JSON.stringify({ cliVersion: proof.cliVersion, executableFingerprint: proof.executableFingerprint, ...streamProof }, null, 2) });
      receipt = receiptSchema.parse({ ...parent, evalId, validation, repeat: 2, runs: [], status: "ready", failure: null,
        limitUsd, maximumCalls: requested.maximumCalls, deadlineAt: Date.now() + requested.deadlineSeconds * 1000, cliVersion: proof.cliVersion,
        judging: { version: 2, promptFingerprint: judgePromptFingerprint(), packetFingerprint: fingerprint(packet), packet } });
      await evaluationBudget({ directory, resume: false, limitUsd, maximumCalls: requested.maximumCalls });
      await saveGuidanceReceipt({ paths: setup.paths, receipt });
    }
    return await options.execute({ ...requested, validationOf: undefined, cumulativeBudgetUsd: undefined, validationRun: true,
      evalId, maxBudgetUsd: limitUsd, pilot: true });
  } finally { await disposeSnapshotTemplates(); await release(); }
}
