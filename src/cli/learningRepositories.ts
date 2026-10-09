import { readEffectiveConfig } from "../config";
import { authorizedLearningEvents } from "../distill";
import { openEventIndex } from "../eventIndex";
import { bindHistoricalRepository, listHistoricalRepositories } from "../learning/repositories";
import { projectPaths } from "../paths";
import path from "node:path";
import { acquireLocalLock } from "../localFiles/lock";

export async function handleHistoricalRepositories(options: {
  readonly action: "repositories" | "bind";
  readonly id?: string;
}): Promise<void> {
  const { config, policy } = await readEffectiveConfig();

  if (!config.sources["git-metadata"] || !policy.allowedSources.includes("git-metadata")) {
    throw new Error("Enable repository metadata consent before reviewing historical sessions");
  }

  const lock = options.action === "bind"
    ? await acquireLocalLock(path.join(projectPaths.shadowcloneDirectory, "learning-worker.db")) : null;
  if (options.action === "bind" && !lock) throw new Error("Another learning attempt is running");
  const index = await openEventIndex(projectPaths.indexDatabase).catch((error: unknown) => {
    lock?.release();
    throw error;
  });

  try {
    const events = authorizedLearningEvents({ events: index.listEvents(), config });
    const candidates = await listHistoricalRepositories({
      index,
      events,
      blockedOrigins: policy.blockedOrigins,
    });

    if (options.action === "repositories") {
      console.log(JSON.stringify(candidates.map((candidate) => ({
        id: candidate.id,
        directory: candidate.directory,
        repository: candidate.repository.id,
        sessions: candidate.sessionCount,
      })), null, 2));

      return;
    }

    const candidate = candidates.find((entry) => entry.id === options.id);

    if (!candidate) {
      throw new Error("Historical repository association was not found or its remote changed");
    }

    const reconsidered = await bindHistoricalRepository({
      index, candidate, events, paths: projectPaths,
    });
    console.log(`Associated ${candidate.sessionCount} past session(s) with ${candidate.repository.id}; ${reconsidered} processed episode(s) reopened. Run shadowclone learn --deep.`);
  } finally {
    index.close();
    lock?.release();
  }
}
