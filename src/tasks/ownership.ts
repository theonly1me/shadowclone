import { canonicalPath } from "../paths";
import type { TaskContext } from "./context";
import { taskRepository, taskCommand } from "./context";
import type { StartTask, TaskRecord } from "./schema";
import { listTasks, readTask } from "./store";

export function activeTask(task: TaskRecord): boolean {
  return task.state !== "done" && task.state !== "cancelled";
}

export async function boundTask(
  options: TaskContext & { readonly id: string },
): Promise<TaskRecord> {
  const task = await readTask(options);
  const repository = await taskRepository(options);
  if (
    task.repositoryId !== repository.repository.id ||
    task.commonDirectory !== repository.commonDirectory ||
    task.worktree !== repository.root
  )
    throw new Error("Task belongs to another repository or worktree");
  if (!repository.policy.allowedEngines.includes(task.input.host))
    throw new Error("Managed policy blocks this task's host");
  return task;
}

function overlapping(options: {
  readonly left: readonly string[];
  readonly right: readonly string[];
}): boolean {
  return options.left.some((left) =>
    options.right.some(
      (right) =>
        left === "." ||
        right === "." ||
        left === right ||
        left.startsWith(`${right}/`) ||
        right.startsWith(`${left}/`),
    ),
  );
}

export async function checkTaskOwnership(
  options: TaskContext & { readonly id: string; readonly input: StartTask },
): Promise<void> {
  const repository = await taskRepository(options);
  const tasks = (await listTasks(options.paths)).filter(
    (task) =>
      task.id !== options.id &&
      task.commonDirectory === repository.commonDirectory,
  );
  if (
    tasks.some((task) => activeTask(task) && task.worktree === repository.root)
  )
    throw new Error(
      "This worktree already has an unfinished task; resume or cancel it first",
    );
  for (const dependency of options.input.dependencies) {
    const task = tasks.find((entry) => entry.id === dependency);
    if (task?.state !== "done")
      throw new Error(
        "Task dependencies must be completed in this repository first",
      );
    if (!task.verification || task.verification.snapshot.dirty)
      throw new Error(
        "Dependencies must have a committed verified result before dependent work starts",
      );
    await taskCommand({
      ...options,
      command: [
        "git",
        "merge-base",
        "--is-ancestor",
        task.verification.snapshot.head,
        "HEAD",
      ],
    });
  }
  if (!options.input.parentId) {
    if (tasks.some((task) => activeTask(task) && !task.input.parentId))
      throw new Error("This repository already has a coordinator");
    return;
  }
  const parent = tasks.find((task) => task.id === options.input.parentId);
  if (
    !parent ||
    parent.input.parentId ||
    parent.state !== "running" ||
    parent.input.host !== options.input.host
  )
    throw new Error("A worker requires a running coordinator on the same host");
  if (
    !parent.deliveries.some(
      (entry) =>
        entry.sessionId === parent.input.sessionId &&
        entry.guidance === parent.guidance.fingerprint,
    )
  )
    throw new Error(
      "Coordinator must acknowledge its guidance before delegation",
    );
  if (
    canonicalPath(parent.worktree) === repository.root ||
    options.input.scopes.includes(".")
  )
    throw new Error(
      "Workers require a separate worktree and bounded file scopes",
    );
  if (
    options.input.scopes.some(
      (scope) =>
        !parent.input.scopes.some(
          (allowed) =>
            allowed === "." ||
            scope === allowed ||
            scope.startsWith(`${allowed}/`),
        ),
    )
  )
    throw new Error("Worker scopes cannot exceed the coordinator assignment");
  const workers = tasks.filter(
    (task) => task.input.parentId === parent.id && activeTask(task),
  );
  if (
    workers.some((task) =>
      overlapping({ left: task.input.scopes, right: options.input.scopes }),
    )
  )
    throw new Error("Worker scopes overlap; finish the earlier task first");
  const running = workers.filter(
    (task) => task.state === "running" || task.state === "verifying",
  );
  if (running.length >= 2)
    throw new Error("At most two workers may run concurrently");
  if (
    running.some(
      (task) =>
        !task.deliveries.some(
          (entry) =>
            entry.sessionId === task.input.sessionId &&
            entry.worktree === task.worktree &&
            entry.guidance === task.guidance.fingerprint,
        ),
    )
  )
    throw new Error(
      "Confirm the existing worker's workspace and guidance before parallel delegation",
    );
}

export async function requireTaskExecution(
  options: TaskContext & { readonly task: TaskRecord },
): Promise<void> {
  const repository = await taskRepository(options);
  if (repository.policy.maxActionTier === "observe")
    throw new Error("Managed policy permits observation only");
  if (options.task.input.parentId) {
    const parent = await readTask({
      paths: options.paths,
      id: options.task.input.parentId,
    });
    if (
      parent.state !== "running" ||
      parent.guidance.fingerprint !== options.task.guidance.fingerprint
    )
      throw new Error(
        "The coordinator is paused, closed, or has changed guidance",
      );
  }
}
