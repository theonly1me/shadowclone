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
  readonly approvedActions: readonly ActionCapability[];
} {
  const program = new Command()
    .exitOverride()
    .configureOutput({ writeErr: () => {} })
    .helpOption(false)
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .argument("[task...]")
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
  }>();

  return {
    task,
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
