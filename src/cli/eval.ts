import { Command } from "commander";
import { engineIds } from "../config";
import type { EngineId, EngineRunner } from "../engine";
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
  const program = new Command()
    .exitOverride()
    .configureOutput({ writeErr: () => {} })
    .option("--sessions <number>")
    .option("--since <date>")
    .option("--engine <id>")
    .option("--max-budget-usd <number>")
    .option("-y, --yes")
    .option("--json");

  program.parse([...arguments_], { from: "user" });

  const parsedOptions = program.opts<{
    readonly sessions?: string;
    readonly since?: string;
    readonly engine?: string;
    readonly maxBudgetUsd?: string;
    readonly yes?: boolean;
    readonly json?: boolean;
  }>();

  let engine: EngineId | undefined;
  if (parsedOptions.engine !== undefined) {
    const known = engineIds.find(
      (candidate) => candidate === parsedOptions.engine,
    );
    if (!known) {
      throw new Error(
        `Unknown engine "${parsedOptions.engine}". Known engines: ${engineIds.join(", ")}`,
      );
    }
    engine = known;
  }

  const sessions = parsedOptions.sessions
    ? Number.parseInt(parsedOptions.sessions, 10)
    : undefined;

  const maxBudgetUsd = parsedOptions.maxBudgetUsd
    ? Number.parseFloat(parsedOptions.maxBudgetUsd)
    : undefined;

  const json = parsedOptions.json ?? false;
  const yes = parsedOptions.yes ?? false;
  const since = parsedOptions.since;

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
    engine,
    sessions,
    since,
    json,
    maxBudgetUsd,
    runner: options.runner,
    paths: options.paths,
  });
}
