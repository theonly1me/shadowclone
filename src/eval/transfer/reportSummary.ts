import type { EvaluationArm } from "./arms";
import type { TransferReceipt, TransferRun } from "./types";

export interface ArmSummary {
  readonly success: number | null;
  readonly adherence: number | null;
}

export interface EvaluationSummary {
  readonly arms: Readonly<Record<EvaluationArm, ArmSummary>>;
  readonly profileLift: number | null;
  readonly libraryLift: number | null;
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

function adherence(run: TransferRun): number | null {
  const applicable = run.preferences.filter((check) =>
    check.verdict !== "not-applicable"
  );
  if (applicable.length === 0) {
    return null;
  }
  return applicable.filter((check) => check.verdict === "pass").length /
    applicable.length;
}

function mean(values: readonly (number | null)[]): number | null {
  const graded = values.filter((value) => value !== null);
  return graded.length === 0 ? null : graded.reduce((total, value) => total + value, 0) / graded.length;
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
    if (cloneScore === null || skillsScore === null) continue;
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
  const profileLift = arms.clone.adherence === null || arms.skills.adherence === null ? null : arms.clone.adherence - arms.skills.adherence;
  return {
    arms,
    profileLift,
    libraryLift: arms.skills.adherence === null || arms.bare.adherence === null ? null : arms.skills.adherence - arms.bare.adherence,
    wins,
    ties,
    losses,
    correctnessRegressions,
    safetyRegressions: completeRuns.filter((run) =>
      run.safety.some((check) => check.verdict === "fail")
    ).length,
    sampleSize: wins + ties + losses,
    relativeImprovement: arms.skills.adherence === null || arms.skills.adherence === 0 || profileLift === null
      ? null
      : profileLift / arms.skills.adherence,
  };
}
