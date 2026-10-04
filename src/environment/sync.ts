import path from "node:path";
import { readLocalText } from "../localFiles";
import { acquireLocalLock } from "../localFiles/lock";
import type { ProjectPaths } from "../paths";
import { environmentFile, readEnvironment, renderEnvironment } from "./store";
import { nativePublication } from "./native";
import { publishEnvironmentRevision } from "./revision";
import { synchronizePublishedSkills } from "./synchronize";
import { readEffectiveConfig } from "../config";
import { syncBuildSkills, type BuildSkillSyncReport } from "../builds/sync";

export async function syncLearningEnvironment(
  paths: ProjectPaths,
): Promise<BuildSkillSyncReport | null> {
  const state = await readEnvironment(paths);

  if (state?.phase !== "active") {
    return null;
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
      return null;
    }

    const builds = await syncBuildSkills({ state: current });
    const synchronized = config.sources["skill-library"]
      ? await synchronizePublishedSkills({ paths, state: builds.state })
      : { state: builds.state, updates: [], routingBlocked: false };
    const publication = synchronized.routingBlocked
      ? { state: synchronized.state, updates: [] }
      : await nativePublication({
          paths,
          state: synchronized.state,
        });
    const filePath = environmentFile(paths);

    await publishEnvironmentRevision({
      paths,
      updates: [
        ...builds.updates,
        ...synchronized.updates,
        ...publication.updates,
        {
          filePath,
          previous: await readLocalText(filePath),
          next: renderEnvironment(publication.state),
        },
      ],
    });

    return { updated: builds.updated, kept: builds.kept };
  } finally {
    lock.release();
  }
}
