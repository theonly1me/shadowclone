import path from "node:path";
import { z } from "zod";
import { runCommand } from "../dispatch/command";
import { pushWorktree } from "../dispatch/worktreePush";
import { redactSecrets } from "../redact";
import { ownedWrite } from "../storage";
import { taskCommand, type TaskContext } from "./context";
import { githubRepository, inspectTaskPullRequest } from "./github";
import { snapshotWorkspace } from "./snapshot";
import type { TaskActionInput } from "./actionInput";
import type { TaskRecord, WorkspaceSnapshot } from "./schema";
import { requireTaskAction } from "./grants";
import { boundTask } from "./ownership";

export async function runTaskAction(
  options: TaskContext & {
    readonly task: TaskRecord;
    readonly input: TaskActionInput;
    readonly snapshot: WorkspaceSnapshot;
    readonly actionId: string;
  },
): Promise<{
  readonly result: string;
  readonly pullRequest: number | null;
  readonly confirmed: boolean;
}> {
  const task = options.task;
  const input = options.input;
  const runner = options.runner ?? runCommand;
  const context = { ...options, cwd: task.worktree };
  const requireCurrentSnapshot = async () => {
    if (
      (await snapshotWorkspace(context)).fingerprint !==
      options.snapshot.fingerprint
    )
      throw new Error("Task snapshot changed before the action");
    const current = await boundTask({ ...context, id: task.id });
    if (current.state === "paused" || current.state === "cancelled")
      throw new Error("Task action was paused");
    await requireTaskAction({
      ...context,
      task: current,
      action: input.action,
    });
  };
  await requireCurrentSnapshot();
  const execute = async (command: readonly string[]) => {
    const result = await runner({ command, cwd: task.worktree });
    if (result.exitCode !== 0)
      throw new Error(
        "Task action did not complete; inspect and reconcile its recorded intent",
      );
    return result.stdout;
  };
  if (input.action === "commit") {
    if (task.baseline.dirty)
      throw new Error(
        "Automatic commit cannot include changes that predate this task",
      );
    if (!options.snapshot.dirty)
      throw new Error("There are no uncommitted changes");
    await execute(["git", "add", "--all"]);
    const staged = await snapshotWorkspace(context);
    if (
      staged.contentFingerprint !== options.snapshot.contentFingerprint ||
      staged.head !== options.snapshot.head ||
      staged.branch !== options.snapshot.branch
    )
      throw new Error("Workspace changed during staging; no commit was made");
    await execute(["git", "commit", "-m", input.subject]);
    return {
      result: (
        await taskCommand({ ...context, command: ["git", "rev-parse", "HEAD"] })
      ).trim(),
      pullRequest: task.pullRequest,
      confirmed: true,
    };
  }
  if (options.snapshot.dirty)
    throw new Error("Remote actions require a clean, verified commit");
  if (input.action === "push") {
    await pushWorktree({
      repositoryId: task.repositoryId,
      worktree: {
        repoDirectory: task.worktree,
        worktreeDirectory: task.worktree,
        baseCommit: task.baseline.head,
        branch: task.baseline.branch,
      },
      head: options.snapshot.head,
      runner,
    });
    return {
      result: options.snapshot.head,
      pullRequest: task.pullRequest,
      confirmed: true,
    };
  }
  const repository = githubRepository(task);
  if (input.action === "pr-create") {
    if (task.pullRequest)
      throw new Error("This task already has a pull request");
    if (
      !task.actions.some(
        (action) =>
          action.action === "push" &&
          action.state === "completed" &&
          action.head === options.snapshot.head,
      )
    )
      throw new Error("Push the verified task head before creating its PR");
    const bodyFile = path.join(
      options.paths.runDirectory(task.id),
      `${options.actionId}-body.md`,
    );
    await ownedWrite({
      path: bodyFile,
      content: redactSecrets({ text: input.body }),
    });
    const remoteHead = await execute([
      "git",
      "ls-remote",
      "--heads",
      "origin",
      `refs/heads/${task.baseline.branch}`,
    ]);
    if (remoteHead.trim().split(/\s+/)[0] !== options.snapshot.head)
      throw new Error("Remote branch changed after the verified push");
    await requireCurrentSnapshot();
    await execute([
      "gh",
      "pr",
      "create",
      "--repo",
      repository,
      "--head",
      task.baseline.branch,
      "--title",
      redactSecrets({ text: input.title }),
      "--body-file",
      bodyFile,
      ...(input.draft ? ["--draft"] : []),
    ]);
    const result = await execute([
      "gh",
      "pr",
      "view",
      task.baseline.branch,
      "--repo",
      repository,
      "--json",
      "number,url",
    ]);
    const created = z
      .object({ number: z.number().int().positive(), url: z.url() })
      .parse(JSON.parse(result));
    const inspected = await inspectTaskPullRequest({
      ...context,
      task,
      number: created.number,
    });
    if (inspected.pullRequest.headRefOid !== options.snapshot.head)
      throw new Error("Created PR no longer matches the verified task head");
    return {
      result: created.url,
      pullRequest: created.number,
      confirmed: true,
    };
  }
  const inspected = await inspectTaskPullRequest({ ...context, task });
  if (inspected.pullRequest.headRefOid !== options.snapshot.head)
    throw new Error("PR head differs from the verified task head");
  await requireCurrentSnapshot();
  if (input.action === "pr-reply") {
    const bodyFile = path.join(
      options.paths.runDirectory(task.id),
      `${options.actionId}-body.md`,
    );
    await ownedWrite({
      path: bodyFile,
      content: `${redactSecrets({ text: input.body })}\n\n<!-- shadowclone-action:${options.actionId} -->\n`,
    });
    await execute([
      "gh",
      "pr",
      "comment",
      String(inspected.pullRequest.number),
      "--repo",
      repository,
      "--body-file",
      bodyFile,
    ]);
    return {
      result: inspected.pullRequest.url,
      pullRequest: inspected.pullRequest.number,
      confirmed: true,
    };
  }
  if (!inspected.ready) throw new Error(inspected.reasons.join("; "));
  await execute([
    "gh",
    "pr",
    "merge",
    String(inspected.pullRequest.number),
    "--repo",
    repository,
    "--squash",
    "--match-head-commit",
    options.snapshot.head,
  ]);
  const after = await inspectTaskPullRequest({ ...context, task });
  return {
    result:
      after.pullRequest.state === "MERGED"
        ? after.pullRequest.url
        : "Merge requested; GitHub has not confirmed completion",
    pullRequest: after.pullRequest.number,
    confirmed: after.pullRequest.state === "MERGED",
  };
}
