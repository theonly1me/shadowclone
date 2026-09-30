import path from "node:path";
import { readHarnessManifest, harnessManifestPath } from "../harness/manifest";
import {
  captureTaskGuidance,
  fileFingerprint,
  guidanceCurrent,
} from "./guidance";
import { readTaskGrant } from "./grants";
import { checkTaskOwnership } from "./ownership";
import { taskRepository, type TaskContext } from "./context";
import { startTaskSchema, type TaskRecord } from "./schema";
import { snapshotWorkspace } from "./snapshot";
import { readTask, withTaskLock, writeTask } from "./store";

export async function startTask(
  options: TaskContext & { readonly input: unknown },
): Promise<TaskRecord> {
  const input = startTaskSchema.parse(options.input);
  return withTaskLock({
    paths: options.paths,
    run: async () => {
      const repository = await taskRepository(options);
      if (
        repository.policy.maxActionTier === "observe" ||
        !repository.policy.allowedEngines.includes(input.host)
      )
        throw new Error("Managed policy blocks task execution");
      const context = { ...options, cwd: repository.root };
      const id = crypto.randomUUID();
      await checkTaskOwnership({ ...context, id, input });
      const baseline = await snapshotWorkspace(context);
      const parent = input.parentId
        ? await readTask({ paths: options.paths, id: input.parentId })
        : null;
      if (
        parent &&
        input.actions.some((action) => !parent.input.actions.includes(action))
      )
        throw new Error(
          "Worker actions cannot exceed the coordinator's allowance",
        );
      const harness = await readHarnessManifest(repository.root);
      const harnessFingerprint = await fileFingerprint(
        path.join(repository.root, harnessManifestPath),
      );
      if (parent && harnessFingerprint !== parent.harnessFingerprint)
        throw new Error(
          "Repository verification requirements differ from the coordinator; align the checkout before delegating",
        );
      const { grant } = await readTaskGrant(context);
      const now = new Date().toISOString();
      const guidance =
        parent?.guidance ??
        (await captureTaskGuidance({ ...context, id, snapshot: baseline }));
      if (parent && !(await guidanceCurrent({ ...context, task: parent })))
        throw new Error(
          "Worker guidance differs from the current repository requirements; align the checkout before delegating",
        );
      return writeTask({
        paths: options.paths,
        task: {
          version: 1,
          id,
          revision: 0,
          createdAt: now,
          updatedAt: now,
          repositoryId: repository.repository.id,
          repositoryDirectory: repository.repositoryDirectory,
          commonDirectory: repository.commonDirectory,
          worktree: repository.root,
          input,
          state: "running",
          baseline,
          guidance,
          grantRevision: grant?.revision ?? null,
          gate: parent ? parent.gate : (harness?.gate?.command ?? null),
          harnessFingerprint,
          recipes: [
            ...(parent?.recipes ?? harness?.verification ?? []),
            ...input.verification,
          ],
          deliveries: [],
          verification: null,
          review: null,
          repairs: 0,
          notes: [],
          actions: [],
          pullRequest: null,
          corrections: [],
        },
      });
    },
  });
}
