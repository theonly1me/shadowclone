import type { TaskContext } from "./context";
import type { TaskActionInput } from "./actionInput";
import type { TaskRecord, WorkspaceSnapshot } from "./schema";
import { inspectTaskPullRequest } from "./github";

export async function validateTaskAction(
  options: TaskContext & {
    readonly task: TaskRecord;
    readonly input: TaskActionInput;
    readonly snapshot: WorkspaceSnapshot;
  },
): Promise<void> {
  if (options.input.action === "commit") {
    if (options.task.baseline.dirty)
      throw new Error(
        "This task started with existing changes; preserve them and commit through an explicitly reviewed manual handoff",
      );
    if (!options.snapshot.dirty)
      throw new Error("There are no changes to commit");
    return;
  }
  if (options.snapshot.dirty)
    throw new Error("Remote actions require a clean verified commit");
  if (options.input.action === "push") return;
  if (options.input.action === "pr-create") {
    if (options.task.pullRequest) throw new Error("This task already has a PR");
    if (
      !options.task.actions.some(
        (action) =>
          action.action === "push" &&
          action.state === "completed" &&
          action.head === options.snapshot.head,
      )
    )
      throw new Error("Push the verified head before creating a PR");
    return;
  }
  const remote = await inspectTaskPullRequest(options);
  if (remote.pullRequest.headRefOid !== options.snapshot.head)
    throw new Error("The PR head differs from the verified head");
  if (options.input.action === "merge" && !remote.ready)
    throw new Error(remote.reasons.join("; "));
}
