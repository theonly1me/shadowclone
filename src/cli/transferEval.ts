import { Command } from "commander";
import type { TransferOptions } from "../eval/transfer";
import { runTransferEval } from "../eval/transfer";

function parsePositiveNumber(
  value: string | undefined,
  name: string,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    throw new Error(`${name} must be positive`);
  }

  return numericValue;
}

export function parseTransferArguments(
  argumentsList: readonly string[],
): TransferOptions {
  const program = new Command()
    .exitOverride()
    .configureOutput({ writeErr: () => {} })
    .allowUnknownOption(false)
    .option("--repo <path>")
    .option("--model <id>")
    .option("--engine <id>")
    .option("--tasks <number>")
    .option("--sessions <number>")
    .option("--repeat <number>")
    .option("--timeout-seconds <number>")
    .option("--eval-id <id>")
    .option("--since <date>")
    .option("--max-budget-usd <number>")
    .option("-y, --yes")
    .option("--json");

  program.parse([...argumentsList], { from: "user" });

  const options = program.opts<{
    readonly repo?: string;
    readonly model?: string;
    readonly engine?: string;
    readonly tasks?: string;
    readonly sessions?: string;
    readonly repeat?: string;
    readonly timeoutSeconds?: string;
    readonly evalId?: string;
    readonly since?: string;
    readonly maxBudgetUsd?: string;
    readonly yes?: boolean;
    readonly json?: boolean;
  }>();

  if (options.tasks !== undefined && options.sessions !== undefined) {
    throw new Error("Use --tasks or --sessions, not both");
  }

  const engine = options.engine;
  if (
    engine !== undefined &&
    engine !== "codex" &&
    engine !== "claude-code"
  ) {
    throw new Error("Evaluation supports codex and claude-code");
  }

  const taskCountValue = options.tasks ?? options.sessions;
  const taskCountName = options.tasks !== undefined ? "--tasks" : "--sessions";

  return {
    repo: options.repo,
    model: options.model,
    engine,
    tasks: parsePositiveNumber(taskCountValue, taskCountName),
    repeat: parsePositiveNumber(options.repeat, "--repeat"),
    timeoutSeconds: parsePositiveNumber(
      options.timeoutSeconds,
      "--timeout-seconds",
    ),
    evalId: options.evalId,
    since: options.since,
    maxBudgetUsd: parsePositiveNumber(options.maxBudgetUsd, "--max-budget-usd"),
    json: options.json ?? false,
  };
}

export async function transferEvalCommand(
  argumentsList: readonly string[],
): Promise<void> {
  await runTransferEval(parseTransferArguments(argumentsList));
}
