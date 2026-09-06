import { runEval } from "../eval";

export async function evalCommand(arguments_: readonly string[]): Promise<void> {
  let sessions: number | undefined;
  let since: string | undefined;
  let json = false;
  let maxBudgetUsd: number | undefined;

  for (let i = 0; i < arguments_.length; i++) {
    const arg = arguments_[i];
    if (arg === "--json") {
      json = true;
    } else if (arg === "--sessions" && i + 1 < arguments_.length) {
      const parsed = Number.parseInt(arguments_[i + 1] ?? "", 10);
      if (!Number.isNaN(parsed)) {
        sessions = parsed;
      }
      i++;
    } else if (arg === "--since" && i + 1 < arguments_.length) {
      since = arguments_[i + 1];
      i++;
    } else if (arg === "--max-budget-usd" && i + 1 < arguments_.length) {
      const parsed = Number.parseFloat(arguments_[i + 1] ?? "");
      if (!Number.isNaN(parsed)) {
        maxBudgetUsd = parsed;
      }
      i++;
    }
  }

  await runEval({ sessions, since, json, maxBudgetUsd });
}
