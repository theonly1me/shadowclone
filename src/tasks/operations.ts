import { z } from "zod";
import type { TaskContext } from "./context";
import { taskRepository } from "./context";
import { startTaskSchema, taskIdSchema } from "./schema";
import { startTask } from "./start";
import { checkpointSchema, checkpointTask } from "./checkpoint";
import { resumeTaskSchema, resumeTask, pauseTask } from "./lifecycle";
import { verifyTask } from "./verify";
import { taskStatus } from "./readiness";
import { actOnTask } from "./actions";
import { taskActionInputSchema } from "./actionInput";
import { maintainTask, reconcileTask } from "./maintenance";
import { listTasks } from "./store";

export const taskOperationSchema = z.discriminatedUnion("operation", [
  z.strictObject({ operation: z.literal("start"), input: startTaskSchema }),
  z.strictObject({ operation: z.literal("status"), id: taskIdSchema }),
  z.strictObject({ operation: z.literal("list") }),
  z.strictObject({
    operation: z.literal("checkpoint"),
    id: taskIdSchema,
    input: checkpointSchema,
  }),
  z.strictObject({ operation: z.literal("verify"), id: taskIdSchema }),
  z.strictObject({ operation: z.literal("pause"), id: taskIdSchema }),
  z.strictObject({
    operation: z.literal("cancel"),
    id: taskIdSchema,
    sessionsStopped: z.literal(true),
  }),
  z.strictObject({
    operation: z.literal("resume"),
    id: taskIdSchema,
    input: resumeTaskSchema,
  }),
  z.strictObject({
    operation: z.literal("action"),
    id: taskIdSchema,
    input: taskActionInputSchema,
  }),
  z.strictObject({ operation: z.literal("maintain"), id: taskIdSchema }),
  z.strictObject({ operation: z.literal("reconcile"), id: taskIdSchema }),
]);

export async function taskSummaries(context: TaskContext) {
  const repository = await taskRepository(context);
  return (await listTasks(context.paths))
    .filter(
      (task) =>
        task.repositoryId === repository.repository.id &&
        task.commonDirectory === repository.commonDirectory,
    )
    .map((task) => ({
      id: task.id,
      title: task.input.title,
      state: task.state,
      host: task.input.host,
      parentId: task.input.parentId ?? null,
      updatedAt: task.updatedAt,
      verification: task.verification?.status ?? "not-run",
      review: task.review?.passed ?? null,
      finish: task.input.finish,
      interruptedActions: task.actions.filter(
        (action) => action.state === "pending" || action.state === "uncertain",
      ).length,
    }));
}

export async function runTaskOperation(
  options: TaskContext & { readonly request: unknown },
): Promise<unknown> {
  const request = taskOperationSchema.parse(options.request);
  if (request.operation === "list") return taskSummaries(options);
  if (request.operation === "start")
    return startTask({ ...options, input: request.input });
  if (request.operation === "status")
    return taskStatus({ ...options, id: request.id });
  if (request.operation === "checkpoint")
    return checkpointTask({ ...options, id: request.id, input: request.input });
  if (request.operation === "verify")
    return verifyTask({ ...options, id: request.id });
  if (request.operation === "pause")
    return pauseTask({ ...options, id: request.id });
  if (request.operation === "cancel")
    return pauseTask({
      ...options,
      id: request.id,
      cancel: true,
      sessionsStopped: request.sessionsStopped,
    });
  if (request.operation === "resume")
    return resumeTask({ ...options, id: request.id, input: request.input });
  if (request.operation === "action")
    return actOnTask({ ...options, id: request.id, input: request.input });
  if (request.operation === "maintain")
    return maintainTask({ ...options, id: request.id });
  return reconcileTask({ ...options, id: request.id });
}
