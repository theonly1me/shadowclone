import path from "node:path";
import { readBoundedFile } from "../../../io/files";
import type { ProjectPaths } from "../../../paths";
import { budgetSchema } from "../../transfer/accounting";
import { fingerprint } from "../../transfer/structured";
import { sourceJudgePromptFingerprint } from "../judgePrompt";
import { validateMaintenanceDelta } from "../maintenance/change";
import { maintenanceParent } from "../maintenance/parent";
import { validateSourceJudging } from "../sourceEvidence";
import { sourceJudgingSchema } from "../sourceEvidenceSchema";
import {
  guidanceDirectory,
  readGuidanceReceipt,
  readGuidanceSuite,
} from "../store";

export async function comparisonParent(options: {
  readonly paths: ProjectPaths;
  readonly parentEvalId: string;
}) {
  const parent = await readGuidanceReceipt({
    paths: options.paths,
    evalId: options.parentEvalId,
  });

  if (
    parent.status !== "complete" ||
    !parent.maintenance ||
    parent.validation ||
    parent.comparison ||
    parent.repeat !== 2 ||
    !parent.pilot ||
    parent.runs.length !== 16 ||
    parent.runs.some(
      (run) =>
        !run.complete ||
        run.votes.length !== 2 ||
        run.resolvedModel !== "claude-sonnet-5",
    ) ||
    parent.model !== "claude-sonnet-5"
  ) {
    throw new Error("Comparison requires a completed maintenance evaluation");
  }

  if (
    fingerprint(
      await readGuidanceSuite({
        paths: options.paths,
        suiteId: parent.suite.suiteId,
      }),
    ) !== parent.suiteFingerprint
  ) {
    throw new Error("Comparison frozen suite changed");
  }

  const chain = await maintenanceParent({
    paths: options.paths,
    parentEvalId: parent.maintenance.parentEvalId,
  });

  if (
    fingerprint({ ...parent.maintenance, ...chain.accounting }) !==
    fingerprint(parent.maintenance)
  ) {
    throw new Error("Maintenance accounting chain changed");
  }

  validateMaintenanceDelta({
    parent: chain.parent.suite,
    suite: parent.suite,
    manifest: parent.maintenance.manifest,
  });

  if (
    chain.parent.judging?.version !== 2 ||
    (parent.judging?.version !== 3 && parent.judging?.version !== 4)
  ) {
    throw new Error("Historical source evidence is missing");
  }

  validateSourceJudging({
    judging: parent.judging,
    suite: parent.suite,
    repository: chain.parent.judging.packet,
  });

  const directory = guidanceDirectory({
    paths: options.paths,
    evalId: parent.evalId,
  });
  const text = await readBoundedFile({
    filePath: path.join(directory, "budget.json"),
    roots: [directory],
    maximumBytes: 4096,
  });

  if (!text) {
    throw new Error("Maintenance budget is missing");
  }

  const budget = budgetSchema.parse(JSON.parse(text));

  if (
    budget.pending ||
    budget.unknownCost ||
    budget.limitUsd !== parent.limitUsd ||
    budget.maximumCalls !== parent.maximumCalls ||
    budget.calls > budget.maximumCalls ||
    budget.spentUsd > parent.limitUsd
  ) {
    throw new Error("Maintenance budget is unresolved or changed");
  }

  const judging = sourceJudgingSchema.parse({
    ...parent.judging,
    version: 4,
    promptFingerprint: sourceJudgePromptFingerprint(4),
  });

  validateSourceJudging({
    judging,
    suite: parent.suite,
    repository: chain.parent.judging.packet,
  });

  return {
    parent,
    judging,
    accounting: {
      parentReceiptFingerprint: fingerprint(parent),
      parentBudgetFingerprint: fingerprint(budget),
      priorSpentUsd: parent.maintenance.priorSpentUsd + budget.spentUsd,
      priorCalls: parent.maintenance.priorCalls + budget.calls,
    },
  };
}
