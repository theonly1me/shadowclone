import path from "node:path";
import { z } from "zod";
import { harnessManifestPath } from "../harness/manifest";
import type { TaskContext } from "./context";
import { captureTaskGuidance, fileFingerprint } from "./guidance";
import { readTaskGrant } from "./grants";
import { activeTask, boundTask, checkTaskOwnership } from "./ownership";
import { taskActionSchema } from "./schema";
import { snapshotWorkspace } from "./snapshot";
import {
  listTasks,
  readTask,
  withTaskLock,
  withTaskOperationLock,
  writeTask,
} from "./store";

export const resumeTaskSchema = z.strictObject({
  sessionId: z.string().min(1).max(200),
  previousSessionStopped: z.literal(true),
  actions: z.array(taskActionSchema).max(5).optional(),
});

export async function pauseTask(
  options: TaskContext & {
    readonly id: string;
    readonly cancel?: boolean;
    readonly sessionsStopped?: boolean;
  },
) {
  return withTaskLock({
    paths: options.paths,
    run: async () => {
      const task = await boundTask(options);
      if (!activeTask(task)) throw new Error("The task is already closed");
      if (options.cancel && options.sessionsStopped !== true)
        throw new Error(
          "Stop all native worker sessions before cancelling and releasing their reservations",
        );
      const children = (await listTasks(options.paths)).filter(
        (entry) => entry.input.parentId === task.id && activeTask(entry),
      );
      if (
        options.cancel &&
        [task, ...children].some((entry) => entry.verificationOperation)
      )
        throw new Error(
          "Pause verification and wait for it to stop before cancelling; resume a crashed verifier to clear its recovery marker",
        );
      if (
        options.cancel &&
        [task, ...children].some((entry) =>
          entry.actions.some(
            (action) =>
              action.state === "pending" || action.state === "uncertain",
          ),
        )
      )
        throw new Error(
          "Reconcile interrupted actions before cancelling their task",
        );
      const state = options.cancel
        ? ("cancelled" as const)
        : ("paused" as const);
      const updated = await writeTask({
        paths: options.paths,
        task: { ...task, state },
      });
      for (const child of children)
        await writeTask({ paths: options.paths, task: { ...child, state } });
      return updated;
    },
  });
}

export async function resumeTask(
  options: TaskContext & { readonly id: string; readonly input: unknown },
) {
  const input = resumeTaskSchema.parse(options.input);
  return withTaskOperationLock({
    paths: options.paths,
    id: options.id,
    run: () =>
      withTaskLock({
        paths: options.paths,
        run: async () => {
          const task = await boundTask(options);
          if (!activeTask(task))
            throw new Error("Closed tasks cannot be resumed");
          if (
            task.actions.some(
              (action) =>
                action.state === "pending" || action.state === "uncertain",
            )
          )
            throw new Error("Reconcile interrupted actions before resuming");
          const context = { ...options, cwd: task.worktree };
          const { grant, repository } = await readTaskGrant(context);
          if (repository.policy.maxActionTier === "observe")
            throw new Error("Managed policy blocks task execution");
          if (
            input.actions?.some(
              (action) => !task.input.actions.includes(action),
            )
          )
            throw new Error(
              "Resume can narrow the task's action allowance but cannot widen it",
            );
          const snapshot = await snapshotWorkspace(context);
          if (snapshot.branch !== task.baseline.branch)
            throw new Error("Restore the task branch before resuming");
          if (
            (await fileFingerprint(
              path.join(task.worktree, harnessManifestPath),
            )) !== task.harnessFingerprint
          )
            throw new Error(
              "Repository requirements changed; review them before starting a new task",
            );
          const nextInput = {
            ...task.input,
            sessionId: input.sessionId,
            actions: (input.actions ?? task.input.actions).filter((action) =>
              grant?.actions.includes(action),
            ),
          };
          await checkTaskOwnership({
            ...context,
            id: task.id,
            input: nextInput,
          });
          const parent = task.input.parentId
            ? await readTask({ paths: options.paths, id: task.input.parentId })
            : null;
          const guidance =
            parent?.guidance ??
            (await captureTaskGuidance({ ...context, id: task.id, snapshot }));
          return writeTask({
            paths: options.paths,
            task: {
              ...task,
              input: nextInput,
              state: "running",
              verificationOperation: null,
              guidance,
              grantRevision: grant?.revision ?? null,
              deliveries: [],
              review: null,
              verification: null,
              repairs: 0,
            },
          });
        },
      }),
  });
}
