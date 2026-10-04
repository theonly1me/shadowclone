import path from "node:path";
import { readEffectiveConfig } from "../config";
import { publishEnvironmentRevision } from "../environment/revision";
import { environmentFile, readEnvironment, renderEnvironment } from "../environment/store";
import { readLocalText } from "../localFiles";
import { acquireLocalLock } from "../localFiles/lock";
import type { ProjectPaths } from "../paths";
import { syncBuildSkills, type BuildSkillSyncReport } from "./sync";

export async function updateBundledSkills(
  paths: ProjectPaths,
): Promise<BuildSkillSyncReport | null> {
  if ((await readEnvironment(paths))?.phase !== "active") {
    return null;
  }

  const { policy } = await readEffectiveConfig({
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

    const synced = await syncBuildSkills({ state: current });
    const filePath = environmentFile(paths);

    await publishEnvironmentRevision({
      paths,
      updates: [
        ...synced.updates,
        {
          filePath,
          previous: await readLocalText(filePath),
          next: renderEnvironment(synced.state),
        },
      ],
    });

    return { updated: synced.updated, kept: synced.kept };
  } finally {
    lock.release();
  }
}
