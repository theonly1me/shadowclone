import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { EngineRunner } from "../../engine";
import type { ProjectPaths } from "../../paths";
import { redactSecrets } from "../../redact";
import { ownedWrite } from "../../storage";
import { evaluationBudget } from "../transfer/accounting";
import { modelCaller } from "../transfer/call";
import { withEvaluationDeadline, throwIfEvaluationExpired } from "../transfer/deadline";
import { lockEvaluation } from "../transfer/lock";
import { setupTransferEval } from "../transfer/setup";
import { disposeSnapshotTemplates } from "../transfer/snapshot";
import { fingerprint } from "../transfer/structured";
import { executeGuidance } from "./execute";
import { judgeGuidance } from "./judge";
import { prepareGuidanceSuite, validateScenarios } from "./prepare";
import { guidanceReport } from "./report";
import { arms, type GuidanceReceipt, type guidanceProtocols } from "./schema";
import { guidanceDirectory, readGuidanceReceipt, readGuidanceSuite, saveGuidanceReceipt } from "./store";
import { verifyClaudeContract, type ClaudeContractProof } from "./claudeContract";
import { recoverSchemaFailure } from "./recovery";
import { runValidation } from "./validation";
import type { ClaudeStreamProof } from "./claudeContract/streamProbe";
import { runMaintenance } from "./maintenance";
import { runComparison } from "./comparison";

export type GuidanceOptions = {
  readonly protocol?: (typeof guidanceProtocols)[number];
  readonly engine?: "claude-code" | "codex";
  readonly repo: string;
  readonly model: string;
  readonly maxBudgetUsd?: number;
  readonly validationOf?: string;
  readonly cumulativeBudgetUsd?: number;
  readonly validationRun?: boolean;
  readonly maintenanceOf?: string;
  readonly additionalBudgetUsd?: number;
  readonly maintenanceRun?: boolean;
  readonly comparisonOf?: string;
  readonly comparisonRun?: boolean;
  readonly maximumCalls: number;
  readonly deadlineSeconds: number;
  readonly pilot: boolean;
  readonly scenarioFile?: string;
  readonly memorySource?: string;
  readonly memoryManifest?: string;
  readonly suiteId?: string;
  readonly evalId?: string;
  readonly recoverPreflightFailure?: boolean;
  readonly failedCliVersion?: string;
  readonly paths?: ProjectPaths;
  readonly runner?: EngineRunner;
  readonly verifyContract?: () => Promise<ClaudeContractProof>;
  readonly verifyStream?: () => Promise<ClaudeStreamProof>;
};

export async function runGuidanceEvaluation(options: GuidanceOptions): Promise<GuidanceReceipt> {
  if (options.comparisonOf) return runComparison({ options, execute: runGuidanceEvaluation });
  if (options.maintenanceOf) return runMaintenance({ options, execute: runGuidanceEvaluation });
  if (options.validationOf) return runValidation({ options, execute: runGuidanceEvaluation });
  if (options.maxBudgetUsd === undefined) throw new Error("An explicit evaluation budget is required");
  if (options.pilot && options.maxBudgetUsd > 5 && !options.validationRun && !options.maintenanceRun) throw new Error("Pilot budget cannot exceed $5");
  if (options.recoverPreflightFailure && (!options.evalId || !options.failedCliVersion)) throw new Error("Preflight recovery requires an existing receipt and observed CLI version");
  const engine = options.engine ?? "claude-code";
  if (engine === "codex" && (options.protocol !== "guidance-skills-v1" || options.recoverPreflightFailure)) throw new Error("Codex guidance requires the skills protocol");
  const setup = await setupTransferEval({ repo: options.repo, engine, model: options.model, reasoningEffort: "medium", paths: options.paths, runner: options.runner });
  const saved = options.evalId ? await readGuidanceReceipt({ paths: setup.paths, evalId: options.evalId }) : null;
  if (saved && (saved.engine ?? "claude-code") !== engine) throw new Error("Resume must retain the original engine");
  if (saved?.validation && !options.validationRun) throw new Error("Resume linked validation with --validation-of");
  if (saved?.maintenance && !options.maintenanceRun) throw new Error("Resume maintenance with --maintenance-of");
  if (saved?.comparison && !options.comparisonRun) throw new Error("Resume comparison with --comparison-of");
  const suite = saved?.suite ?? (options.suiteId ? await readGuidanceSuite({ paths: setup.paths, suiteId: options.suiteId }) :
    options.scenarioFile && options.memorySource
      ? await prepareGuidanceSuite({ setup, protocol: options.protocol ?? "guidance-v1", scenarioFile: options.scenarioFile, memorySource: options.memorySource, memoryManifest: options.memoryManifest })
      : null);
  if (!suite) throw new Error("Provide a frozen suite or scenario file with an explicit memory source");
  if (options.protocol && suite.protocol !== options.protocol) throw new Error("Frozen suite protocol does not match the request");
  validateScenarios(suite);
  if (suite.repository !== setup.repository) throw new Error("Frozen suite belongs to a different repository");
  if (saved && (saved.model !== options.model || saved.limitUsd !== options.maxBudgetUsd || saved.maximumCalls !== options.maximumCalls || saved.pilot !== options.pilot)) throw new Error("Resume must retain model, condition selection, and original limits");
  if (saved && fingerprint(await readGuidanceSuite({ paths: setup.paths, suiteId: saved.suite.suiteId })) !== saved.suiteFingerprint) throw new Error("Frozen suite changed since the original evaluation");
  let receipt: GuidanceReceipt = saved ?? {
    protocol: suite.protocol, schemaVersion: 1, evalId: setup.evalId, suite, suiteFingerprint: fingerprint(suite), model: options.model, effort: "medium", ...(engine === "codex" ? { engine } : {}),
    pilot: options.pilot, repeat: options.pilot ? 1 : 2, maximumCalls: options.maximumCalls, limitUsd: options.maxBudgetUsd,
    deadlineAt: Date.now() + options.deadlineSeconds * 1000, status: "ready", failure: null, runs: [],
  };
  const directory = guidanceDirectory({ paths: setup.paths, evalId: receipt.evalId });
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const release = await lockEvaluation(directory);
  const controlDirectory = await mkdtemp(path.join(os.tmpdir(), "shadowclone-guidance-control-"));
  let persistReceipt = saved === null;
  const save = async (): Promise<void> => {
    await saveGuidanceReceipt({ paths: setup.paths, receipt });
    await ownedWrite({ path: path.join(directory, "guidance-report.json"), content: JSON.stringify(guidanceReport(receipt), null, 2) });
  };
  try {
    if (receipt.status === "complete") return receipt;
    if (!options.recoverPreflightFailure && receipt.deadlineAt <= Date.now()) throw new Error("Original guidance deadline has expired");
    const proof = engine === "claude-code" ? await (options.verifyContract ?? verifyClaudeContract)() : null;
    if (proof && options.recoverPreflightFailure && options.failedCliVersion) {
      receipt = await recoverSchemaFailure({ paths: setup.paths, receipt, proof, failedCliVersion: options.failedCliVersion });
    }
    if (receipt.deadlineAt <= Date.now()) throw new Error("Original guidance deadline has expired");
    if (proof) {
      await ownedWrite({ path: path.join(directory, "claude-contract.json"), content: JSON.stringify(proof, null, 2) });
      receipt = { ...receipt, cliVersion: proof.cliVersion };
    }
    const budget = await evaluationBudget({ directory, resume: saved !== null, limitUsd: options.maxBudgetUsd, maximumCalls: options.maximumCalls });
    persistReceipt = true;
    const baseCall = modelCaller({ runner: setup.runner, budget, engine, model: options.model, reasoningEffort: "medium", timeoutSeconds: 180,
      maxBudgetUsd: options.maxBudgetUsd, blockedPaths: [setup.repository, setup.paths.shadowcloneDirectory, setup.paths.claudeProjectsDirectory,
        ...[".claude/skills", ".claude/CLAUDE.md", ".agents/skills", ".codex/skills", ".codex/memories"].map((relative) => path.join(path.dirname(setup.paths.shadowcloneDirectory), relative))], controlDirectory });
    const call: typeof baseCall = async (request) => {
      const response = await baseCall(request);
      if ((receipt.maintenance || receipt.comparison) && (response.costUsd === null || !Number.isFinite(response.costUsd) || response.costUsd < 0)) throw new Error("Evaluation cost is unknown; stop without another invocation");
      if (!response.resolvedModel || !(response.resolvedModel === options.model || response.resolvedModel.startsWith(`${options.model}-`))) throw new Error(`Requested ${options.model}; received ${response.resolvedModel ?? "unknown model"}`);
      if (receipt.validation && response.resolvedModel !== receipt.validation.resolvedModel) throw new Error("Resolved model differs from the original pilot");
      if (receipt.maintenance && response.resolvedModel !== receipt.maintenance.resolvedModel) throw new Error("Resolved model differs from the approved maintenance model");
      if (receipt.comparison && response.resolvedModel !== receipt.comparison.resolvedModel) throw new Error("Resolved model differs from the approved comparison model");
      const previous = receipt.runs[0]?.resolvedModel;
      if (previous && previous !== response.resolvedModel) throw new Error("Resolved model changed during the evaluation");
      return response;
    };
    receipt = { ...receipt, status: "running", failure: null };
    await save();
    await withEvaluationDeadline({ enabled: true, durationMs: receipt.deadlineAt - Date.now(), operation: async () => {
      for (const scenario of suite.scenarios.filter((candidate) => !options.pilot || candidate.pilot)) {
        for (let repeat = 0; repeat < receipt.repeat; repeat += 1) {
          const rotation = (suite.scenarios.indexOf(scenario) + repeat) % arms.length;
          for (const arm of [...arms.slice(rotation), ...arms.slice(0, rotation)]) {
            throwIfEvaluationExpired();
            let candidate = receipt.runs.find((run) => run.scenarioId === scenario.id && run.repeat === repeat && run.arm === arm);
            if (candidate?.complete) continue;
            console.log(`guidance ${scenario.id} repeat ${repeat + 1} ${arm}: ${candidate ? "judging saved evidence" : "executing"}`);
            if (!candidate) {
              candidate = await executeGuidance({ suite, scenario, arm, repeat, call, engine });
              throwIfEvaluationExpired();
              receipt = { ...receipt, runs: [...receipt.runs, candidate] };
              await save();
            }
            const replace = (): void => {
              const updated = candidate;
              if (!updated) throw new Error("Candidate is unavailable");
              receipt = { ...receipt, runs: receipt.runs.map((run) => run.scenarioId === scenario.id && run.repeat === repeat && run.arm === arm ? updated : run) };
            };
            if (candidate.safety === "fail") throw new Error("Candidate failed snapshot safety checks");
            for (const vote of [1, 2]) {
              if (candidate.votes.some((entry) => entry.vote === vote)) continue;
              const checks = await judgeGuidance({ scenario, candidate, vote, cwd: controlDirectory, call,
                packet: receipt.judging?.version === 2 ? receipt.judging.packet : undefined,
                sourceJudging: receipt.judging?.version === 3 || receipt.judging?.version === 4 ? receipt.judging : undefined });
              throwIfEvaluationExpired();
              candidate = { ...candidate, votes: [...candidate.votes, { vote, checks }] };
              replace();
              await save();
            }
            candidate = { ...candidate, complete: true };
            replace();
            await save();
          }
        }
      }
    } });
    receipt = { ...receipt, status: "complete" };
  } catch (error) {
    if (!persistReceipt) throw error;
    receipt = { ...receipt, status: "error", failure: redactSecrets({ text: error instanceof Error ? error.message : "Guidance evaluation failed" }) };
  } finally {
    if (persistReceipt) await save();
    await disposeSnapshotTemplates();
    await rm(controlDirectory, { recursive: true, force: true });
    await release();
  }
  return receipt;
}
