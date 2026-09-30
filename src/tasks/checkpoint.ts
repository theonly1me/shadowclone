import { z } from "zod";
import { canonicalPath } from "../paths";
import { rememberPreference } from "../preferences";
import { workflowOutcomeSchema } from "../eval/shared/outcome";
import type { TaskContext } from "./context";
import { boundTask, requireTaskExecution } from "./ownership";
import { taskReadiness } from "./readiness";
import { digestSchema, taskIdSchema, taskReviewSchema } from "./schema";
import { recordTaskIntegration } from "./integration";
import { snapshotWorkspace } from "./snapshot";
import { withTaskLock, writeTask } from "./store";

export const checkpointSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("integration"),
    childId: taskIdSchema,
    childSnapshot: digestSchema,
  }),
  z.strictObject({
    kind: z.literal("delivery"),
    sessionId: z.string().min(1).max(200),
    guidance: digestSchema,
    worktree: z.string().min(1),
  }),
  z.strictObject({
    kind: z.literal("note"),
    text: z.string().min(1).max(4000),
  }),
  z.strictObject({ kind: z.literal("repair") }),
  z.strictObject({ kind: z.literal("review"), review: taskReviewSchema }),
  z.strictObject({ kind: z.literal("complete") }),
  z.strictObject({
    kind: z.literal("correction"),
    text: z.string().min(1).max(4000),
    userRequested: z.literal(true),
  }),
  z.strictObject({
    kind: z.literal("outcome"),
    outcome: workflowOutcomeSchema,
  }),
]);

export async function checkpointTask(
  options: TaskContext & { readonly id: string; readonly input: unknown },
) {
  const input = checkpointSchema.parse(options.input);
  return withTaskLock({
    paths: options.paths,
    run: async () => {
      let task = await boundTask(options);
      if (input.kind === "outcome")
        return writeTask({
          paths: options.paths,
          task: { ...task, outcome: input.outcome },
        });
      if (
        task.state === "paused" ||
        task.state === "cancelled" ||
        task.state === "done"
      )
        throw new Error("Resume an active task before recording progress");
      const context = { ...options, cwd: task.worktree };
      await requireTaskExecution({ ...context, task });
      if (input.kind === "integration") {
        task = await recordTaskIntegration({
          ...context,
          task,
          childId: input.childId,
          childSnapshot: input.childSnapshot,
        });
      } else if (input.kind === "delivery") {
        if (
          input.guidance !== task.guidance.fingerprint ||
          canonicalPath(input.worktree) !== task.worktree
        )
          throw new Error(
            "Delivery must acknowledge the exact task guidance and worktree",
          );
        task = {
          ...task,
          deliveries: [
            ...task.deliveries.filter(
              (entry) => entry.sessionId !== input.sessionId,
            ),
            {
              sessionId: input.sessionId,
              guidance: input.guidance,
              worktree: task.worktree,
              at: new Date().toISOString(),
              kind: "agent-acknowledged",
            },
          ],
        };
      } else if (input.kind === "note") {
        task = { ...task, notes: [...task.notes, input.text] };
      } else if (input.kind === "repair") {
        if (
          task.repairs !== 0 ||
          !task.verification ||
          task.verification.status === "passed"
        )
          throw new Error(
            "One repair is available after a failed or incomplete verification",
          );
        task = { ...task, repairs: 1, state: "running", review: null };
      } else if (input.kind === "review") {
        const snapshot = await snapshotWorkspace(context);
        if (
          input.review.snapshot !== snapshot.fingerprint ||
          input.review.guidance !== task.guidance.fingerprint
        )
          throw new Error(
            "Review must describe the current workspace and guidance",
          );
        if (
          task.input.substantive &&
          input.review.sessionId === task.input.sessionId
        )
          throw new Error(
            "Substantive changes require a different reviewer session",
          );
        if (
          !task.deliveries.some(
            (entry) =>
              entry.sessionId === input.review.sessionId &&
              entry.guidance === task.guidance.fingerprint,
          )
        )
          throw new Error("Reviewer must acknowledge the task guidance first");
        if (
          input.review.acceptance.length !== task.input.acceptance.length ||
          task.input.acceptance.some(
            (criterion) =>
              input.review.acceptance.filter(
                (entry) => entry.criterion === criterion,
              ).length !== 1,
          )
        )
          throw new Error(
            "Review must address each acceptance criterion exactly once",
          );
        task = { ...task, review: input.review };
      } else if (input.kind === "correction") {
        const key = await rememberPreference({
          ...context,
          scope: "repository",
          text: input.text,
        });
        task = { ...task, corrections: [...task.corrections, key] };
      }
      const readiness = await taskReadiness({ ...context, task });
      if (input.kind === "complete") {
        if (!readiness.ready) throw new Error(readiness.reasons.join("; "));
        if (
          task.input.finish === "ship" &&
          !task.actions.some(
            (action) =>
              action.action === "merge" && action.state === "completed",
          )
        )
          throw new Error("Shipping finish line requires a confirmed merge");
        task = { ...task, state: "done" };
      } else if (readiness.ready) task = { ...task, state: "review-ready" };
      return writeTask({ paths: options.paths, task });
    },
  });
}
