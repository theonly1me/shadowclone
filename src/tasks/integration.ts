import type { TaskContext } from "./context";
import type { TaskRecord } from "./schema";
import { readTask } from "./store";
import { snapshotWorkspace } from "./snapshot";

export async function recordTaskIntegration(
  options: TaskContext & {
    readonly task: TaskRecord;
    readonly childId: string;
    readonly childSnapshot: string;
  },
): Promise<TaskRecord> {
  const child = await readTask({ paths: options.paths, id: options.childId });
  const verified = child.verification;
  if (
    child.input.parentId !== options.task.id ||
    child.state !== "done" ||
    verified?.status !== "passed" ||
    verified.snapshot.fingerprint !== options.childSnapshot
  )
    throw new Error(
      "Integration requires this coordinator's completed, verified worker result",
    );
  const snapshot = await snapshotWorkspace({
    ...options,
    cwd: options.task.worktree,
  });
  const files = new Set([
    ...Object.keys(child.baseline.files),
    ...Object.keys(verified.snapshot.files),
  ]);
  for (const file of files) {
    if (
      child.baseline.files[file] !== verified.snapshot.files[file] &&
      snapshot.files[file] !== verified.snapshot.files[file]
    )
      throw new Error(
        "Integrate the worker's changed files before recording its result",
      );
  }
  return {
    ...options.task,
    integrations: [
      ...(options.task.integrations ?? []).filter(
        (entry) => entry.childId !== child.id,
      ),
      {
        childId: child.id,
        childSnapshot: options.childSnapshot,
        parentSnapshot: snapshot.fingerprint,
      },
    ],
  };
}
