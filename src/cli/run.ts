import {
  actionCapabilities,
  type ActionCapability,
} from "../config";
import { runHeadlessClone } from "../dispatch";

export function parseRunArguments(arguments_: readonly string[]): {
  readonly task: string;
  readonly approvedActions: readonly ActionCapability[];
} {
  const taskParts: string[] = [];
  const approvedActions: ActionCapability[] = [];

  for (let position = 0; position < arguments_.length; position += 1) {
    const value = arguments_[position];
    if (value !== "--approve") {
      if (value) {
        taskParts.push(value);
      }
      continue;
    }
    const requested = arguments_[position + 1];
    const action = actionCapabilities.find(
      (candidate) => candidate === requested,
    );
    if (!action) {
      throw new Error("Run approval must name a supported action");
    }
    approvedActions.push(action);
    position += 1;
  }

  const task = taskParts.join(" ").trim();
  if (task.length === 0) {
    throw new Error("Run requires a task");
  }
  return { task, approvedActions: [...new Set(approvedActions)] };
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
