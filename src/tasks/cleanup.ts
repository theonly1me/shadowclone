import { readdir } from "node:fs/promises";
import type { ProjectPaths } from "../paths";
import { activeTask } from "./ownership";
import { listTasks } from "./store";

export async function assertTaskCleanupSafe(
  paths: ProjectPaths,
): Promise<void> {
  if (
    (await listTasks(paths)).some(
      (task) => activeTask(task) || task.verificationOperation,
    )
  )
    throw new Error(
      "Unfinished tasks remain. Stop their native sessions and complete or cancel the tasks before forgetting their records",
    );
  const worktrees = await readdir(paths.worktreesDirectory).catch(() => []);
  if (worktrees.length > 0)
    throw new Error(
      "Managed worktrees remain. Preserve their changes and move or remove them explicitly before forgetting Shadowclone data",
    );
}
