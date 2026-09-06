import { Command } from "commander";
import type { TransferOptions } from "../eval/transfer";
import {
  defaultTimeoutSeconds,
  invocationCeiling,
  runTransferEval,
} from "../eval/transfer";
import { promptConfirmation, type ConfirmPrompt } from "./confirm";

const valueFlags = [
  "--repo <path>",
  "--model <id>",
  "--engine <id>",
  "--tasks <number>",
  "--sessions <number>",
  "--repeat <number>",
  "--timeout-seconds <number>",
  "--eval-id <id>",
  "--since <date>",
  "--max-budget-usd <number>",
] as const;

function rejectRepeat(
  flag: string,
): (value: string, previous: string | undefined) => string {
  const [name] = flag.split(" ");

  return (value, previous) => {
    if (previous !== undefined) {
      throw new Error(`Repeated ${name ?? flag}`);
    }
    return value;
  };
}

function parsePositiveNumber(options: {
  readonly value: string | undefined;
  readonly name: string;
}): number | undefined {
  if (options.value === undefined) {
    return undefined;
  }

  const numericValue = Number(options.value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    throw new Error(`${options.name} must be positive`);
  }

  return numericValue;
}

export function parseTransferArguments(
  argumentsList: readonly string[],
): TransferOptions {
  const program = valueFlags.reduce(
    (current, flag) => current.option(flag, "", rejectRepeat(flag)),
    new Command()
      .exitOverride()
      .configureOutput({ writeErr: () => {} })
      .allowUnknownOption(false)
      .option("-y, --yes")
      .option("--json"),
  );

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
    tasks: parsePositiveNumber({
      value: taskCountValue,
      name: taskCountName,
    }),
    repeat: parsePositiveNumber({ value: options.repeat, name: "--repeat" }),
    timeoutSeconds: parsePositiveNumber({
      value: options.timeoutSeconds,
      name: "--timeout-seconds",
    }),
    evalId: options.evalId,
    since: options.since,
    maxBudgetUsd: parsePositiveNumber({
      value: options.maxBudgetUsd,
      name: "--max-budget-usd",
    }),
    json: options.json ?? false,
    yes: options.yes ?? false,
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
