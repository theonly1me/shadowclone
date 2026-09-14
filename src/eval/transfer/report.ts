import { redactSecrets } from "../../redact";
import { evaluationArmOrder } from "./arms";
import { summarize } from "./reportSummary";
import type { TransferReceipt } from "./types";

export { summarize, type EvaluationSummary, type ArmSummary } from "./reportSummary";

export function evaluationStatus(receipt: TransferReceipt): TransferReceipt["status"] {
  if (receipt.runs.some((run) => run.failure !== null)) return "error";
  const expected = receipt.prepared.tasks.length * receipt.prepared.repeat * evaluationArmOrder.length;
  return receipt.runs.length === expected && receipt.runs.every((run) => run.phase === "complete")
    ? "complete" : "running";
}

function percentage(value: number | null): string {
  return value === null ? "ungraded" : `${(value * 100).toFixed(1)}%`;
}

function points(value: number | null): string {
  return value === null ? "ungraded" : `${(value * 100).toFixed(1)} percentage points`;
}

export function reportLines(receipt: TransferReceipt): readonly string[] {
  const summary = summarize(receipt);
  const effort = receipt.prepared.reasoningEffort ?? "provider default";
  const relative = summary.profileLift === null ? "ungraded" :
    summary.relativeImprovement === null
      ? (summary.arms.clone.adherence ?? 0) > 0 ? "newly achieved" : "0.0%"
      : percentage(summary.relativeImprovement);
  const decisionGrade = receipt.prepared.tasks.length >= 3 && receipt.prepared.repeat >= 2;
  return [
    `Evaluation ${receipt.evalId}: ${receipt.status.toUpperCase()}`,
    `Suite: ${receipt.prepared.suiteId}`,
    `Engine: ${receipt.prepared.engine}; model: ${receipt.prepared.model}; effort: ${effort}`,
    `Profile: ${receipt.prepared.profileSnapshot.ruleCount} frozen current rules`,
    `${receipt.prepared.tasks.length} tasks x ${receipt.prepared.repeat} repeats; ${summary.sampleSize} compared samples`,
    `Decision grade: ${decisionGrade ? "yes" : "no"}; requires at least 3 tasks x 2 repeats`,
    "Review method: three independent blinded votes per arm; correctness and source-backed coding preferences graded separately with saved vote batches",
    ...evaluationArmOrder.map((arm) =>
      `  ${arm.padEnd(7)} correctness success ${percentage(summary.arms[arm].success)}; preference adherence ${percentage(summary.arms[arm].adherence)}`
    ),
    `Profile lift (clone over skills): ${points(summary.profileLift)}; relative: ${relative}`,
    `Profile improvement: ${summary.profileLift === null ? "ungraded" : summary.profileLift > 0 ? "demonstrated" : "not demonstrated"}; this is separate from evaluation completion`,
    `Library lift (skills over bare): ${points(summary.libraryLift)}`,
    `Pair outcomes against skills: ${summary.wins} wins, ${summary.ties} ties, ${summary.losses} losses`,
    `Correctness regressions: ${summary.correctnessRegressions}; safety regressions: ${summary.safetyRegressions}`,
    `Uncommitted source files ignored: ${receipt.prepared.dirtyFileCount}`,
    "Inspect the private receipt before publishing aggregate results.",
  ];
}

export function printReport(options: {
  readonly receipt: TransferReceipt;
  readonly json: boolean;
}): void {
  if (options.json) {
    console.log(redactSecrets({ text: JSON.stringify(options.receipt) }));
    return;
  }
  for (const line of reportLines(options.receipt)) console.log(line);
}
