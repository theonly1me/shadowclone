import path from "node:path";
import { z } from "zod";
import { fingerprint, readLocalText } from "../localFiles";
import { ownedWrite } from "../storage";
import { taskRepository, type TaskContext } from "./context";
import { taskActionSchema, type TaskAction, type TaskRecord } from "./schema";
import { withTaskLock } from "./store";

const grantSchema = z.strictObject({
  version: z.literal(1),
  revision: z.uuid(),
  repositoryId: z.string(),
  commonDirectory: z.string(),
  actions: z.array(taskActionSchema),
  decidedAt: z.string(),
});

export async function readTaskGrant(options: TaskContext) {
  const repository = await taskRepository(options);
  const key = fingerprint(
    JSON.stringify([repository.repository.id, repository.commonDirectory]),
  );
  const filePath = path.join(
    options.paths.shadowcloneDirectory,
    "task-grants",
    `${key}.json`,
  );
  const text = await readLocalText(filePath);
  const grant = text === null ? null : grantSchema.parse(JSON.parse(text));
  if (
    grant &&
    (grant.repositoryId !== repository.repository.id ||
      grant.commonDirectory !== repository.commonDirectory)
  )
    throw new Error("Task grant repository mismatch");
  return { grant, filePath, repository };
}

export async function setTaskGrant(
  options: TaskContext & { readonly actions: readonly TaskAction[] },
) {
  return withTaskLock({
    paths: options.paths,
    run: async () => {
      const { repository, filePath } = await readTaskGrant(options);
      if (
        options.actions.length > 0 &&
        repository.policy.maxActionTier !== "act"
      )
        throw new Error("Managed policy does not permit action grants");
      const grant = grantSchema.parse({
        version: 1,
        revision: crypto.randomUUID(),
        repositoryId: repository.repository.id,
        commonDirectory: repository.commonDirectory,
        actions: [...new Set(options.actions)],
        decidedAt: new Date().toISOString(),
      });
      await ownedWrite({
        path: filePath,
        content: `${JSON.stringify(grant, null, 2)}\n`,
      });
      return grant;
    },
  });
}

export async function requireTaskAction(
  options: TaskContext & {
    readonly task: TaskRecord;
    readonly action: TaskAction;
  },
): Promise<void> {
  const { grant, repository } = await readTaskGrant(options);
  if (
    repository.policy.maxActionTier !== "act" ||
    !grant ||
    grant.revision !== options.task.grantRevision ||
    !grant.actions.includes(options.action) ||
    !options.task.input.actions.includes(options.action)
  )
    throw new Error(
      "Action requires a current repository grant and a matching task allowance",
    );
  if (options.action === "merge" && options.task.input.finish !== "ship")
    throw new Error("This task ends at review and cannot merge");
}
