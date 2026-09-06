import type { EngineRunner } from "../engine";
import { runEval } from "../eval";
import type { ProjectPaths } from "../paths";

export type EvalPrompt = (question: string) => boolean | Promise<boolean>;

function promptConfirmation(question: string): boolean {
  const answer = prompt(`${question} [y/N]`);
  return answer?.trim().toLowerCase() === "y";
}

export async function evalCommand(
  arguments_: readonly string[],
  options: {
    readonly ask?: EvalPrompt;
    readonly runner?: EngineRunner;
    readonly paths?: ProjectPaths;
  } = {},
): Promise<void> {
  let sessions: number | undefined;
  let since: string | undefined;
  let json = false;
  let maxBudgetUsd: number | undefined;
  let yes = false;

  for (
    let argumentIndex = 0;
    argumentIndex < arguments_.length;
    argumentIndex++
  ) {
    const argument = arguments_[argumentIndex];
    if (argument === "--json") {
      json = true;
    } else if (argument === "--yes" || argument === "-y") {
      yes = true;
    } else if (
      argument === "--sessions" &&
      argumentIndex + 1 < arguments_.length
    ) {
      argumentIndex++;
      const parsed = Number.parseInt(arguments_[argumentIndex] ?? "", 10);
      if (!Number.isNaN(parsed)) {
        sessions = parsed;
      }
    } else if (
      argument === "--since" &&
      argumentIndex + 1 < arguments_.length
    ) {
      argumentIndex++;
      since = arguments_[argumentIndex];
    } else if (
      argument === "--max-budget-usd" &&
      argumentIndex + 1 < arguments_.length
    ) {
      argumentIndex++;
      const parsed = Number.parseFloat(arguments_[argumentIndex] ?? "");
      if (!Number.isNaN(parsed)) {
        maxBudgetUsd = parsed;
      }
    }
  }

  const sessionLimit = sessions ?? 10;
  const budgetLimit = maxBudgetUsd ?? 0.5;
  const upperCostUsd = sessionLimit * 2 * budgetLimit;
  const ask = options.ask ?? promptConfirmation;

  if (!yes && !json && process.stdin.isTTY) {
    const message = `Running eval on up to ${sessionLimit} sessions (2 runs each, max $${upperCostUsd.toFixed(2)} budget). Proceed?`;
    const approved = await ask(message);
    if (!approved) {
      console.log("Evaluation cancelled.");
      return;
    }
  }

  await runEval({
    sessions,
    since,
    json,
    maxBudgetUsd,
    runner: options.runner,
    paths: options.paths,
  });
}
