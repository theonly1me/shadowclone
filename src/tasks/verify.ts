import path from "node:path";
import { harnessManifestPath } from "../harness/manifest";
import type { TaskContext } from "./context";
import { fileFingerprint, guidanceCurrent } from "./guidance";
import { boundTask, requireTaskExecution } from "./ownership";
import { taskReadiness } from "./readiness";
import { snapshotWorkspace } from "./snapshot";
import {
  readTask,
  withTaskLock,
  withTaskOperationLock,
  writeTask,
} from "./store";
import { runTaskVerification } from "./verificationRun";
import type { TaskRecord } from "./schema";

export async function verifyTask(
  options: TaskContext & { readonly id: string },
) {
  return withTaskOperationLock({
    paths: options.paths,
    id: options.id,
    run: async () => {
      const prepared = await withTaskLock({
        paths: options.paths,
        run: async () => {
          const task = await boundTask(options);
          if (["paused", "cancelled", "done", "verifying"].includes(task.state))
            throw new Error(
              "Only active tasks can be verified; resume interrupted verification first",
            );
          const context = { ...options, cwd: task.worktree };
          await requireTaskExecution({ ...context, task });
          if (!(await guidanceCurrent({ ...context, task })))
            throw new Error(
              "Guidance changed; resume with reviewed guidance before verifying",
            );
          if (
            (await fileFingerprint(
              path.join(task.worktree, harnessManifestPath),
            )) !== task.harnessFingerprint
          )
            throw new Error("Repository verification requirements changed");
          const before = await snapshotWorkspace(context);
          const cached =
            task.verification?.status === "passed" &&
            task.verification.snapshot.fingerprint === before.fingerprint;
          const previousAttempts =
            task.verification?.status === "passed"
              ? 0
              : (task.verification?.attempts ?? 0);
          if (!cached && previousAttempts >= 2)
            throw new Error(
              "The verification and one repair attempt are exhausted; review the failure before starting another task",
            );
          if (!cached && previousAttempts > 0 && task.repairs !== 1)
            throw new Error(
              "Record the single repair checkpoint before retrying verification",
            );
          const pending = cached
            ? task
            : await writeTask({
                paths: options.paths,
                task: {
                  ...task,
                  state: "verifying",
                  verificationOperation: crypto.randomUUID(),
                },
              });
          return {
            task: pending,
            before,
            attempts: previousAttempts + 1,
            cached,
          };
        },
      });
      if (prepared.cached) return prepared.task;
      const controller = new AbortController();
      let polling = false;
      const monitor = setInterval(() => {
        if (polling) return;
        polling = true;
        readTask(options)
          .then((current) => {
            if (
              current.state !== "verifying" ||
              current.verificationOperation !==
                prepared.task.verificationOperation
            )
              controller.abort();
          })
          .catch(() => controller.abort())
          .finally(() => {
            polling = false;
          });
      }, 200);
      try {
        const verification = await runTaskVerification({
          ...options,
          cwd: prepared.task.worktree,
          task: prepared.task,
          before: prepared.before,
          attempts: prepared.attempts,
          signal: controller.signal,
        });
        return await withTaskLock({
          paths: options.paths,
          run: async () => {
            const current = await boundTask(options);
            if (
              current.verificationOperation !==
              prepared.task.verificationOperation
            )
              throw new Error("Task verification ownership changed");
            const stopped =
              current.state === "paused" || current.state === "cancelled";
            const updated: TaskRecord = {
              ...current,
              verificationOperation: null,
              verification,
              repairs: verification.status === "passed" ? 0 : current.repairs,
              state: stopped
                ? current.state
                : verification.status === "passed"
                  ? "running"
                  : "blocked",
            };
            const readiness = await taskReadiness({
              ...options,
              task: updated,
              snapshot: verification.snapshot,
            });
            return writeTask({
              paths: options.paths,
              task: {
                ...updated,
                state:
                  !stopped && readiness.ready ? "review-ready" : updated.state,
              },
            });
          },
        });
      } finally {
        clearInterval(monitor);
      }
    },
  });
}
