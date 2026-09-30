import path from "node:path";
import { harnessManifestPath } from "../harness/manifest";
import { guidanceCurrent, fileFingerprint } from "./guidance";
import { readTaskGrant } from "./grants";
import { boundTask, activeTask } from "./ownership";
import { snapshotWorkspace, outsideTaskScope } from "./snapshot";
import { listTasks, readTask } from "./store";
import type { TaskContext } from "./context";
import type { TaskRecord, WorkspaceSnapshot } from "./schema";

export async function taskReadiness(
  options: TaskContext & {
    readonly task: TaskRecord;
    readonly snapshot?: WorkspaceSnapshot;
  },
) {
  const task = options.task;
  const context = { ...options, cwd: task.worktree };
  const snapshot = options.snapshot ?? (await snapshotWorkspace(context));
  const reasons: string[] = [];
  if (task.input.parentId) {
    const parent = await readTask({
      paths: options.paths,
      id: task.input.parentId,
    });
    if (
      parent.state !== "running" ||
      parent.guidance.fingerprint !== task.guidance.fingerprint
    )
      reasons.push("Coordinator must be running with the same guidance");
  }
  if (task.state === "paused" || task.state === "cancelled")
    reasons.push(`Task is ${task.state}`);
  if (task.verificationOperation)
    reasons.push("Verification is still running or needs recovery");
  if (snapshot.branch !== task.baseline.branch)
    reasons.push("Task branch changed");
  if (
    outsideTaskScope({
      baseline: task.baseline,
      current: snapshot,
      scopes: task.input.scopes,
    }).length > 0
  )
    reasons.push("Changes extend outside the assigned file scopes");
  if (!(await guidanceCurrent({ ...context, task })))
    reasons.push("Guidance changed; review it and resume the task");
  if (
    (await fileFingerprint(path.join(task.worktree, harnessManifestPath))) !==
    task.harnessFingerprint
  )
    reasons.push(
      "Repository requirements changed; start a new task after reviewing them",
    );
  const { grant } = await readTaskGrant(context);
  if ((grant?.revision ?? null) !== task.grantRevision)
    reasons.push("Repository grant changed; resume with the current allowance");
  if (
    !task.deliveries.some(
      (entry) =>
        entry.sessionId === task.input.sessionId &&
        entry.guidance === task.guidance.fingerprint &&
        entry.worktree === task.worktree,
    )
  )
    reasons.push("Worker has not acknowledged this workspace and guidance");
  const children = (await listTasks(options.paths)).filter(
    (entry) => entry.input.parentId === task.id,
  );
  if (children.some(activeTask))
    reasons.push("Delegated work is still unfinished");
  if (
    children.some(
      (child) =>
        child.state === "done" &&
        !task.integrations?.some(
          (entry) =>
            entry.childId === child.id &&
            entry.childSnapshot === child.verification?.snapshot.fingerprint,
        ),
    )
  )
    reasons.push("Completed worker results need an integration checkpoint");
  const verification = task.verification;
  if (verification?.status !== "passed")
    reasons.push("Required verification has not passed");
  else if (
    verification.snapshot.fingerprint !== snapshot.fingerprint ||
    verification.guidance !== task.guidance.fingerprint
  )
    reasons.push("Verification is stale");
  const review = task.review;
  if (
    !review?.passed ||
    review.acceptance.length !== task.input.acceptance.length ||
    task.input.acceptance.some(
      (criterion) =>
        !review.acceptance.some(
          (entry) => entry.criterion === criterion && entry.passed,
        ),
    )
  )
    reasons.push(
      "Acceptance criteria and engineering standards need a passing review",
    );
  else if (
    review.snapshot !== snapshot.fingerprint ||
    review.guidance !== task.guidance.fingerprint
  )
    reasons.push("Review is stale");
  if (
    review &&
    task.input.substantive &&
    review.sessionId === task.input.sessionId
  )
    reasons.push("Substantive changes require a different reviewer session");
  if (
    task.actions.some(
      (action) => action.state === "pending" || action.state === "uncertain",
    )
  )
    reasons.push(
      "An interrupted action needs reconciliation before another action",
    );
  return { ready: reasons.length === 0, reasons, snapshot };
}

export async function taskStatus(
  options: TaskContext & { readonly id: string },
) {
  const task = await boundTask(options);
  return { task, ...(await taskReadiness({ ...options, task })) };
}
