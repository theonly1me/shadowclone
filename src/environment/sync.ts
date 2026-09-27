import path from "node:path";
import { readLocalText } from "../localFiles";
import { acquireLocalLock } from "../localFiles/lock";
import type { ProjectPaths } from "../paths";
import { environmentFile, readEnvironment, renderEnvironment } from "./store";
import { nativePublication } from "./native";
import { publishEnvironmentRevision } from "./revision";
import { synchronizePublishedSkills } from "./synchronize";
import { readEffectiveConfig } from "../config";

export async function syncLearningEnvironment(paths: ProjectPaths): Promise<boolean> {
  const state = await readEnvironment(paths);
  if (state?.phase !== "active") return false;
  const { config, policy } = await readEffectiveConfig({ configPath: paths.configFile, managedConfigPath: paths.managedConfigFile });
  if (!policy.enabled) throw new Error("Managed policy blocks synchronization");
  const lock = await acquireLocalLock(path.join(paths.shadowcloneDirectory, "environment-write.db"));
  if (!lock) throw new Error("Another learning environment update is running");
  try {
    const current = await readEnvironment(paths);
    if (current?.phase !== "active") return false;
    const synchronized = config.sources["skill-library"] ? await synchronizePublishedSkills({ paths, state: current }) : { state: current, updates: [] };
    const publication = await nativePublication({ paths, state: synchronized.state });
    const filePath = environmentFile(paths);
    await publishEnvironmentRevision({ paths, updates: [...synchronized.updates, ...publication.updates, { filePath, previous: await readLocalText(filePath), next: renderEnvironment(publication.state) }] });
    return true;
  } finally { lock.release(); }
}
