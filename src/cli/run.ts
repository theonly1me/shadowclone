import { Command } from "commander";
import {
  actionCapabilities,
  type ActionCapability,
} from "../config";
import { runHeadlessClone } from "../dispatch";

function collectApprovals(
  value: string,
  previous: readonly ActionCapability[],
): readonly ActionCapability[] {
  const action = actionCapabilities.find(
    (candidate) => candidate === value,
  );
  if (!action) {
    throw new Error("Run approval must name a supported action");
  }

  return [...previous, action];
}

export function parseRunArguments(arguments_: readonly string[]): {
  readonly task: string;
  readonly pullRequestNumber?: number;
  readonly approvedActions: readonly ActionCapability[];
} {
  const program = new Command()
    .exitOverride()
    .configureOutput({ writeErr: () => {} })
    .helpOption(false)
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .argument("[task...]")
    .option("--pr <number>", "Approved target PR for pr-reply")
    .option(
      "--approve <action>",
      "Approved action capability",
      collectApprovals,
      [],
    );

  program.parse([...arguments_], { from: "user" });

  const task = program.args.join(" ").trim();
  if (task.length === 0) {
    throw new Error("Run requires a task");
  }

  const options = program.opts<{
    readonly approve: readonly ActionCapability[];
    readonly pr?: string;
  }>();

  const pullRequestNumber = options.pr === undefined ? undefined : Number(options.pr);
  if (pullRequestNumber !== undefined && (!Number.isSafeInteger(pullRequestNumber) || pullRequestNumber < 1)) {
    throw new Error("--pr must be a positive integer");
  }
  return {
    task,
    ...(pullRequestNumber === undefined ? {} : { pullRequestNumber }),
    approvedActions: [...new Set(options.approve)],
  };
}

export async function runClone(
  arguments_: readonly string[],
): Promise<void> {
  const options = parseRunArguments(arguments_);
  const receipt = await runHeadlessClone(options);
  console.log(
    `Clone run ${receipt.runId} finished. Review ~/.shadowclone/runs/${receipt.runId}/receipt.json.`,
  );
}
