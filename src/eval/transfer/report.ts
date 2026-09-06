import { redactSecrets } from "../../redact";
import type { TransferReceipt, TransferRun } from "./types";

export interface EvaluationSummary {
  readonly wins: number;
  readonly ties: number;
  readonly losses: number;
  readonly uncertain: number;
  readonly correctnessRegressions: number;
}

function calculateAdherence(run: TransferRun): number | null {
  if (
    run.failure ||
    run.preferences.length === 0 ||
    run.preferences.some((check) => check.verdict === "uncertain")
  ) {
    return null;
  }

  const passingChecks = run.preferences.filter(
    (check) => check.verdict === "pass",
  );

  return passingChecks.length / run.preferences.length;
}

export function summarize(receipt: TransferReceipt): EvaluationSummary {
  let wins = 0;
  let ties = 0;
  let losses = 0;
  let uncertain = 0;
  let correctnessRegressions = 0;

  const groupedRuns = Map.groupBy(
    receipt.runs,
    (run) => `${run.taskId}:${run.repeat}`,
  );

  for (const pair of groupedRuns.values()) {
    const baseline = pair.find((run) => run.arm === "baseline");
    const clone = pair.find((run) => run.arm === "clone");

    if (!baseline || !clone) {
      uncertain++;
      continue;
    }

    const baselineScore = calculateAdherence(baseline);
    const cloneScore = calculateAdherence(clone);

    if (baselineScore === null || cloneScore === null) {
      uncertain++;
    } else if (cloneScore > baselineScore) {
      wins++;
    } else if (cloneScore < baselineScore) {
      losses++;
    } else {
      ties++;
    }

    const baselinePassedAll =
      baseline.correctness.length > 0 &&
      baseline.correctness.every((check) => check.verdict === "pass");

    const cloneHasRegression =
      clone.failure !== null ||
      clone.correctness.some((check) => check.verdict === "fail");

    if (baselinePassedAll && cloneHasRegression) {
      correctnessRegressions++;
    }
  }

  return {
    wins,
    ties,
    losses,
    uncertain,
    correctnessRegressions,
  };
}

export function printReport(options: {
  readonly receipt: TransferReceipt;
  readonly json: boolean;
}): void {
  if (options.json) {
    console.log(redactSecrets({ text: JSON.stringify(options.receipt) }));
    return;
  }

  const summary = summarize(options.receipt);

  console.log(`Evaluation ${options.receipt.evalId}: ${options.receipt.status}`);
  console.log(
    `${options.receipt.prepared.tasks.length} tasks; ${options.receipt.prepared.exclusions.length} excluded`,
  );
  console.log(
    `Preference pairs: ${summary.wins} wins, ${summary.ties} ties, ${summary.losses} losses, ${summary.uncertain} uncertain`,
  );
  console.log(`Correctness regressions: ${summary.correctnessRegressions}`);

  console.log(
    "Automatic evidence is provisional. Inspect the receipt before making product claims.",
  );
}
