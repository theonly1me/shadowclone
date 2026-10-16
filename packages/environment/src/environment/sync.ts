import path from "node:path";
import { readLocalText, acquireLocalLock, readEffectiveConfig } from "@shadowclone/core";
import type { ProjectPaths } from "@shadowclone/core";
import { environmentFile, readEnvironment, renderEnvironment } from "./store";
import { nativePublication, type ReplacedRouting, type SkippedRouting } from "./native";
import { publishEnvironmentRevision } from "./revision";
import { synchronizePublishedSkills } from "./synchronize";
import { withoutMissingRepositories } from "./missingRepositories";

export async function syncLearningEnvironment(
  paths: ProjectPaths,
  options: {
    readonly onSkipped?: (skipped: readonly SkippedRouting[]) => void;
    readonly onReplaced?: (replaced: readonly ReplacedRouting[]) => void;
    readonly onRemovedRepositories?: (directories: readonly string[]) => void;
    readonly replaceEdited?: boolean;
  } = {},
): Promise<boolean> {
  const state = await readEnvironment(paths);

  if (state?.phase !== "active") {
    return false;
  }

  const { config, policy } = await readEffectiveConfig({
    configPath: paths.configFile,
    managedConfigPath: paths.managedConfigFile,
  });

  if (!policy.enabled) {
    throw new Error("Managed policy blocks synchronization");
  }

  const lock = await acquireLocalLock(
    path.join(paths.shadowcloneDirectory, "environment-write.db"),
  );

  if (!lock) {
    throw new Error("Another learning environment update is running");
  }

  try {
    const current = await readEnvironment(paths);

    if (current?.phase !== "active") {
      return false;
    }

    const registered = await withoutMissingRepositories(current);
    const synchronized = config.sources["skill-library"]
      ? await synchronizePublishedSkills({ paths, state: registered.state })
      : { state: registered.state, updates: [], routingBlocked: false };
    const publication = synchronized.routingBlocked
      ? { state: synchronized.state, updates: [], skipped: [], replaced: [] }
      : await nativePublication({
          paths,
          state: synchronized.state,
          skipLinkedFiles: options.onSkipped !== undefined,
          replaceEdited: options.replaceEdited,
        });
    const filePath = environmentFile(paths);

    await publishEnvironmentRevision({
      paths,
      updates: [
        ...synchronized.updates,
        ...publication.updates,
        {
          filePath,
          previous: await readLocalText(filePath),
          next: renderEnvironment(publication.state),
        },
      ],
    });

    options.onRemovedRepositories?.(registered.removed);
    options.onReplaced?.(publication.replaced);
    options.onSkipped?.(publication.skipped);

    return true;
  } finally {
    lock.release();
  }
}
