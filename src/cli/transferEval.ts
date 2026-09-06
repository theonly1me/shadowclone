import type { TransferOptions } from "../eval/transfer";
import { runTransferEval } from "../eval/transfer";

const supportedValueFlags = new Set([
  "--repo",
  "--model",
  "--engine",
  "--tasks",
  "--sessions",
  "--repeat",
  "--timeout-seconds",
  "--eval-id",
  "--since",
  "--max-budget-usd",
]);

export function parseTransferArguments(
  argumentsList: readonly string[],
): TransferOptions {
  const flagValues = new Map<string, string>();
  let outputAsJson = false;

  for (
    let argumentIndex = 0;
    argumentIndex < argumentsList.length;
    argumentIndex++
  ) {
    const currentArgument = argumentsList[argumentIndex];

    if (currentArgument === "--json") {
      outputAsJson = true;
      continue;
    }

    if (currentArgument === "--yes" || currentArgument === "-y") {
      continue;
    }

    if (!currentArgument || !supportedValueFlags.has(currentArgument)) {
      throw new Error("Unknown evaluation option");
    }

    argumentIndex++;
    const nextValue = argumentsList[argumentIndex];

    if (
      !nextValue ||
      nextValue.startsWith("--") ||
      flagValues.has(currentArgument)
    ) {
      throw new Error(`Missing or repeated ${currentArgument}`);
    }

    flagValues.set(currentArgument, nextValue);
  }

  if (flagValues.has("--tasks") && flagValues.has("--sessions")) {
    throw new Error("Use --tasks or --sessions, not both");
  }

  const engine = flagValues.get("--engine");
  if (
    engine !== undefined &&
    engine !== "codex" &&
    engine !== "claude-code"
  ) {
    throw new Error("Evaluation supports codex and claude-code");
  }

  function parsePositiveNumber(flagName: string): number | undefined {
    const flagText = flagValues.get(flagName);
    if (flagText === undefined) {
      return undefined;
    }

    const numericValue = Number(flagText);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      throw new Error(`${flagName} must be positive`);
    }

    return numericValue;
  }

  const taskCountFlag = flagValues.has("--tasks")
    ? "--tasks"
    : "--sessions";

  return {
    repo: flagValues.get("--repo"),
    model: flagValues.get("--model"),
    engine,
    tasks: parsePositiveNumber(taskCountFlag),
    repeat: parsePositiveNumber("--repeat"),
    timeoutSeconds: parsePositiveNumber("--timeout-seconds"),
    evalId: flagValues.get("--eval-id"),
    since: flagValues.get("--since"),
    maxBudgetUsd: parsePositiveNumber("--max-budget-usd"),
    json: outputAsJson,
  };
}

export async function transferEvalCommand(
  argumentsList: readonly string[],
): Promise<void> {
  await runTransferEval(parseTransferArguments(argumentsList));
}
