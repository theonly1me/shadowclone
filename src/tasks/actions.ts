import { redactSecrets } from "../redact";
import { taskActionInputSchema } from "./actionInput";
import { runTaskAction } from "./actionCommands";
import { validateTaskAction } from "./actionValidation";
import type { TaskContext } from "./context";
import { requireTaskAction } from "./grants";
import { boundTask, requireTaskExecution } from "./ownership";
import { taskReadiness } from "./readiness";
import { withTaskLock, withTaskOperationLock, writeTask } from "./store";
import { snapshotWorkspace } from "./snapshot";

export async function actOnTask(
  options: TaskContext & { readonly id: string; readonly input: unknown },
) {
  const input = taskActionInputSchema.parse(options.input);
  return withTaskOperationLock({
    paths: options.paths,
    id: options.id,
    run: async () => {
      let task = await boundTask(options);
      if (task.state === "done")
        throw new Error("Completed tasks cannot perform more actions");
      const context = { ...options, cwd: task.worktree };
      await requireTaskExecution({ ...context, task });
      await requireTaskAction({ ...context, task, action: input.action });
      const readiness = await taskReadiness({ ...context, task });
      if (!readiness.ready) throw new Error(readiness.reasons.join("; "));
      if (!readiness.snapshot.branch)
        throw new Error("Task actions require a named branch");
      await validateTaskAction({
        ...context,
        task,
        input,
        snapshot: readiness.snapshot,
      });
      if (
        (await snapshotWorkspace(context)).fingerprint !==
        readiness.snapshot.fingerprint
      )
        throw new Error(
          "Workspace changed while checking the action; verify it again",
        );
      await requireTaskAction({ ...context, task, action: input.action });
      const actionId = crypto.randomUUID();
      task = await withTaskLock({
        paths: options.paths,
        run: async () => {
          const current = await boundTask(options);
          if (current.revision !== task.revision)
            throw new Error(
              "Task changed while checking the action; review current status before retrying",
            );
          await requireTaskAction({
            ...context,
            task: current,
            action: input.action,
          });
          return writeTask({
            paths: options.paths,
            task: {
              ...current,
              actions: [
                ...current.actions,
                {
                  id: actionId,
                  action: input.action,
                  state: "pending",
                  head: readiness.snapshot.head,
                  at: new Date().toISOString(),
                  request: redactSecrets({ text: JSON.stringify(input) }),
                  result: "",
                },
              ],
            },
          });
        },
      });
      try {
        const result = await runTaskAction({
          ...context,
          task,
          input,
          snapshot: readiness.snapshot,
          actionId,
        });
        return await withTaskLock({
          paths: options.paths,
          run: async () => {
            const current = await boundTask(options);
            return writeTask({
              paths: options.paths,
              task: {
                ...current,
                pullRequest: result.pullRequest,
                actions: current.actions.map((action) =>
                  action.id === actionId
                    ? {
                        ...action,
                        state: result.confirmed ? "completed" : "pending",
                        result: result.result,
                      }
                    : action,
                ),
              },
            });
          },
        });
      } catch {
        await withTaskLock({
          paths: options.paths,
          run: async () => {
            const current = await boundTask(options);
            await writeTask({
              paths: options.paths,
              task: {
                ...current,
                state: current.state === "paused" ? "paused" : "blocked",
                actions: current.actions.map((action) =>
                  action.id === actionId
                    ? {
                        ...action,
                        state: "uncertain",
                        result:
                          "Action interrupted or failed; inspect recorded intent and reconcile before retrying",
                      }
                    : action,
                ),
              },
            });
          },
        });
        throw new Error(
          "Action did not complete with confirmation. Its intent is saved; use task reconcile before retrying",
        );
      }
    },
  });
}
