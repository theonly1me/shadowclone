import type { z } from "zod";
import type { budgetSchema } from "../../transfer/accounting";
import { fingerprint } from "../../transfer/structured";
import {
  legacySchemaFailure,
  type ClaudeContractProof,
} from "../claudeContract";
import {
  judgmentOutputSchema,
  legacyJudgmentOutputSchema,
} from "../judgeSchema";
import type { GuidanceReceipt } from "../schema";

export function validateRecoveryProof(options: {
  readonly proof: ClaudeContractProof;
  readonly failedCliVersion: string;
}): void {
  if (options.proof.cliVersion !== options.failedCliVersion) {
    throw new Error(
      "Recovery requires the CLI version observed during the failed invocation",
    );
  }

  if (
    options.proof.legacySchemaFingerprint !==
      fingerprint(legacyJudgmentOutputSchema) ||
    options.proof.currentSchemaFingerprint !== fingerprint(judgmentOutputSchema)
  ) {
    throw new Error(
      "Schema contract proof does not match the current judge schemas",
    );
  }
}

export function validateRecoverableFailure(options: {
  readonly receipt: GuidanceReceipt;
  readonly budget: z.infer<typeof budgetSchema>;
  readonly failedCliVersion: string;
}): void {
  const { receipt, budget } = options;
  const [candidate] = receipt.runs;
  const firstCase = receipt.suite.scenarios.find(
    (scenario) => !receipt.pilot || scenario.pilot,
  );

  if (
    receipt.status !== "error" ||
    receipt.failure !== legacySchemaFailure ||
    receipt.runs.length !== 1 ||
    !candidate ||
    candidate.complete ||
    candidate.votes.length !== 0 ||
    candidate.arm !== "bare" ||
    candidate.repeat !== 0 ||
    candidate.scenarioId !== firstCase?.id ||
    candidate.safety !== "pass" ||
    !candidate.evidence ||
    candidate.resolvedModel !== receipt.model ||
    (receipt.cliVersion && receipt.cliVersion !== options.failedCliVersion)
  ) {
    throw new Error(
      "Recovery is limited to the first judge's verified local schema rejection",
    );
  }

  if (
    budget.calls !== 2 ||
    budget.pending ||
    !budget.unknownCost ||
    budget.limitUsd !== receipt.limitUsd ||
    budget.maximumCalls !== receipt.maximumCalls ||
    budget.spentUsd >= receipt.limitUsd
  ) {
    throw new Error(
      "Budget does not identify exactly one completed candidate and one rejected judge invocation",
    );
  }

  if (fingerprint(receipt.suite) !== receipt.suiteFingerprint) {
    throw new Error("Recovery cannot change frozen sources");
  }
}

export function unchangedRecoveryInputs(options: {
  readonly original: GuidanceReceipt;
  readonly current: GuidanceReceipt;
}): boolean {
  const stable = (receipt: GuidanceReceipt) => ({
    evalId: receipt.evalId,
    suiteFingerprint: receipt.suiteFingerprint,
    suite: receipt.suite,
    model: receipt.model,
    effort: receipt.effort,
    repeat: receipt.repeat,
    pilot: receipt.pilot,
    maximumCalls: receipt.maximumCalls,
    limitUsd: receipt.limitUsd,
    candidate: receipt.runs[0]
      ? { ...receipt.runs[0], votes: [], complete: false }
      : null,
  });

  return (
    fingerprint(stable(options.original)) ===
    fingerprint(stable(options.current))
  );
}
