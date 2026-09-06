import type { TransferOptions } from "../eval/transfer";
import {
  defaultTimeoutSeconds,
  invocationCeiling,
  runTransferEval,
} from "../eval/transfer";
import { promptConfirmation, type ConfirmPrompt } from "./confirm";

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
  let skipConfirmation = false;

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
      skipConfirmation = true;
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
    yes: skipConfirmation,
  };
}

export async function transferEvalCommand(
  argumentsList: readonly string[],
  options: { readonly ask?: ConfirmPrompt } = {},
): Promise<void> {
  const parsed = parseTransferArguments(argumentsList);
  const ask = options.ask ?? promptConfirmation;

  if (!parsed.yes && !parsed.json && process.stdin.isTTY) {
    const invocations = invocationCeiling(parsed);
    const timeoutSeconds = parsed.timeoutSeconds ?? defaultTimeoutSeconds;
    const approved = await ask(
      `Running eval as up to ${invocations} agent invocations, each up to ${timeoutSeconds}s. Proceed?`,
    );
    if (!approved) {
      console.log("Evaluation cancelled.");
      return;
    }
  }

  await runTransferEval(parsed);
}
