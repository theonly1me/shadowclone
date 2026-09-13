import { redactSecrets } from "../../redact";
import { type EvaluationArm, evaluationArmOrder } from "./arms";
import type { TransferReceipt, TransferRun } from "./types";

export interface ArmSummary {
  readonly success: number;
  readonly adherence: number;
}

export interface EvaluationSummary {
  readonly arms: Readonly<Record<EvaluationArm, ArmSummary>>;
  readonly profileLift: number;
  readonly libraryLift: number;
  readonly wins: number;
  readonly ties: number;
  readonly losses: number;
  readonly correctnessRegressions: number;
  readonly safetyRegressions: number;
  readonly sampleSize: number;
  readonly relativeImprovement: number | null;
}

function successful(run: TransferRun): boolean {
  return run.phase === "complete" &&
    run.failure === null &&
    run.correctness.length > 0 &&
    run.correctness.every((check) => check.verdict === "pass") &&
    run.safety.length > 0 &&
    run.safety.every((check) => check.verdict === "pass");
}

function adherence(run: TransferRun): number {
  const applicable = run.preferences.filter((check) =>
    check.verdict !== "not-applicable"
  );
  if (applicable.length === 0) {
    return 0;
  }
  return applicable.filter((check) => check.verdict === "pass").length /
    applicable.length;
}

function mean(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((total, value) => total + value, 0) / values.length;
}

export function summarize(receipt: TransferReceipt): EvaluationSummary {
  const completeRuns = receipt.runs.filter((run) => run.phase === "complete");
  const armRuns = (arm: EvaluationArm) =>
    completeRuns.filter((run) => run.arm === arm);
  const summaryFor = (arm: EvaluationArm): ArmSummary => ({
    success: mean(armRuns(arm).map((run) => successful(run) ? 1 : 0)),
    adherence: mean(armRuns(arm).map(adherence)),
  });
  const arms = {
    bare: summaryFor("bare"),
    skills: summaryFor("skills"),
    clone: summaryFor("clone"),
  };
  let wins = 0;
  let ties = 0;
  let losses = 0;
  let correctnessRegressions = 0;
  const groups = Map.groupBy(
    completeRuns,
    (run) => `${run.taskId}:${run.repeat}`,
  );
  for (const group of groups.values()) {
    const skills = group.find((run) => run.arm === "skills");
    const clone = group.find((run) => run.arm === "clone");
    if (!skills || !clone) {
      continue;
    }
    const skillsScore = adherence(skills);
    const cloneScore = adherence(clone);
    if (cloneScore > skillsScore) {
      wins += 1;
    } else if (cloneScore < skillsScore) {
      losses += 1;
    } else {
      ties += 1;
    }
    if (successful(skills) && !successful(clone)) {
      correctnessRegressions += 1;
    }
  }
  const profileLift = arms.clone.adherence - arms.skills.adherence;
  return {
    arms,
    profileLift,
    libraryLift: arms.skills.adherence - arms.bare.adherence,
    wins,
    ties,
    losses,
    correctnessRegressions,
    safetyRegressions: completeRuns.filter((run) =>
      run.safety.some((check) => check.verdict === "fail")
    ).length,
    sampleSize: wins + ties + losses,
    relativeImprovement: arms.skills.adherence === 0
      ? null
      : profileLift / arms.skills.adherence,
  };
}

export function evaluationStatus(
  receipt: TransferReceipt,
): TransferReceipt["status"] {
  if (receipt.runs.some((run) => run.failure !== null)) {
    return "error";
  }
  const summary = summarize(receipt);
  const expectedSamples = receipt.prepared.tasks.length * receipt.prepared.repeat;
  const passed = summary.sampleSize === expectedSamples &&
    summary.profileLift > 0 &&
    summary.arms.clone.success >= summary.arms.skills.success &&
    summary.arms.clone.success > 0 &&
    summary.correctnessRegressions === 0 &&
    summary.safetyRegressions === 0;
  return passed ? "pass" : "fail";
}

function percentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function points(value: number): string {
  return `${(value * 100).toFixed(1)} percentage points`;
}

export function reportLines(receipt: TransferReceipt): readonly string[] {
  const summary = summarize(receipt);
  const effort = receipt.prepared.reasoningEffort ?? "provider default";
  const relative = summary.relativeImprovement === null
    ? summary.arms.clone.adherence > 0 ? "newly achieved" : "0.0%"
    : percentage(summary.relativeImprovement);
  const decisionGrade = receipt.prepared.tasks.length >= 3 &&
    receipt.prepared.repeat >= 2;
  return [
    `Evaluation ${receipt.evalId}: ${receipt.status.toUpperCase()}`,
    `Suite: ${receipt.prepared.suiteId}`,
    `Engine: ${receipt.prepared.engine}; model: ${receipt.prepared.model}; effort: ${effort}`,
    `Profile: ${receipt.prepared.profileSnapshot.ruleCount} frozen current rules`,
    `${receipt.prepared.tasks.length} tasks x ${receipt.prepared.repeat} repeats; ${summary.sampleSize} compared samples`,
    `Decision grade: ${decisionGrade ? "yes" : "no"}; requires at least 3 tasks x 2 repeats`,
    "Review method: three independent blinded votes per arm against verbatim source rules; not-applicable preferences excluded; repository-wide checks not run",
    ...evaluationArmOrder.map((arm) =>
      `  ${arm.padEnd(7)} success ${percentage(summary.arms[arm].success)}; adherence ${percentage(summary.arms[arm].adherence)}`
    ),
    `Profile lift (clone over skills): ${points(summary.profileLift)}; relative: ${relative}`,
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
  for (const line of reportLines(options.receipt)) {
    console.log(line);
  }
}
