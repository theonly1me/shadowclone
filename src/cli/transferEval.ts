import { Command } from "commander";
import type { TransferOptions } from "../eval/transfer";
import {
  defaultTimeoutSeconds,
  invocationCeiling,
  runTransferEval,
} from "../eval/transfer";
import { promptConfirmation, type ConfirmPrompt } from "./confirm";
import {
  parseDependencyMode,
  parsePositiveNumber,
  parseReasoningEffort,
  rejectRepeat,
} from "./transferEvalOptions";

const valueFlags = [
  "--repo <path>",
  "--task <prompt>",
  "--suite-id <id>",
  "--model <id>",
  "--engine <id>",
  "--reasoning-effort <level>",
  "--dependency-mode <mode>",
  "--tasks <number>",
  "--repeat <number>",
  "--timeout-seconds <number>",
  "--deadline-seconds <number>",
  "--eval-id <id>",
  "--max-budget-usd <number>",
] as const;
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
    readonly task?: string;
    readonly suiteId?: string;
    readonly model?: string;
    readonly engine?: string;
    readonly reasoningEffort?: string;
    readonly dependencyMode?: string;
    readonly tasks?: string;
    readonly repeat?: string;
    readonly timeoutSeconds?: string;
    readonly deadlineSeconds?: string;
    readonly evalId?: string;
    readonly maxBudgetUsd?: string;
    readonly yes?: boolean;
    readonly json?: boolean;
  }>();

  if (options.task !== undefined && options.tasks !== undefined) {
    throw new Error("Use --task or --tasks, not both");
  }
  if (options.suiteId !== undefined && (options.task || options.tasks)) {
    throw new Error("A frozen --suite-id cannot be combined with task selection");
  }
  if (options.evalId !== undefined && options.suiteId !== undefined) {
    throw new Error("Use --eval-id to resume or --suite-id to start, not both");
  }
  if (options.evalId !== undefined && (options.task || options.tasks)) {
    throw new Error("An evaluation resume cannot select new tasks");
  }

  const engine = options.engine;
  if (
    engine !== undefined &&
    engine !== "codex" &&
    engine !== "claude-code"
  ) {
    throw new Error("Evaluation supports codex and claude-code");
  }

  return {
    repo: options.repo,
    task: options.task,
    suiteId: options.suiteId,
    model: options.model,
    engine,
    reasoningEffort: parseReasoningEffort(options.reasoningEffort),
    dependencyMode: parseDependencyMode(options.dependencyMode),
    tasks: parsePositiveNumber({
      value: options.tasks,
      name: "--tasks",
    }),
    repeat: parsePositiveNumber({ value: options.repeat, name: "--repeat" }),
    timeoutSeconds: parsePositiveNumber({
      value: options.timeoutSeconds,
      name: "--timeout-seconds",
    }),
    deadlineSeconds: parsePositiveNumber({
      value: options.deadlineSeconds,
      name: "--deadline-seconds",
    }),
    evalId: options.evalId,
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
  if (argumentsList.includes("--dependency-mode")) {
    console.warn(
      "--dependency-mode current is deprecated because current HEAD is now the only evaluation starting state.",
    );
  }

  if (!parsed.yes && !parsed.json && process.stdin.isTTY) {
    const invocations = invocationCeiling({
      tasks: parsed.task ? 1 : parsed.tasks,
      repeat: parsed.repeat,
    });
    const timeoutSeconds = parsed.timeoutSeconds ?? defaultTimeoutSeconds;
    const engineDescription = [
      parsed.engine,
      parsed.model,
      parsed.reasoningEffort
        ? `${parsed.reasoningEffort} effort`
        : undefined,
    ]
      .filter((value) => value !== undefined)
      .join(" ");
    const description = engineDescription
      ? `${engineDescription} as `
      : "";
    const approved = await ask(
      `Running ${description}up to ${invocations} agent invocations, each up to ${timeoutSeconds}s. Proceed?`,
    );
    if (!approved) {
      console.log("Evaluation cancelled.");
      return;
    }
  }

  await runTransferEval(parsed);
}
