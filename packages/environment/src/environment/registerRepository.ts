import path from "node:path";
import {
  readLocalText,
  acquireLocalLock,
  canonicalPath,
  fingerprint,
  type ProjectPaths,
} from "@shadowclone/core";
import { isOriginBlocked, resolveRepository, type GitRemoteReader } from "@shadowclone/sessions";
import { configureSkillMaintenance } from "@shadowclone/skills";
import { publishEnvironmentRevision } from "./revision";
import { environmentFile, readEnvironment, renderEnvironment } from "./store";
import type { EnvironmentRepository } from "./types";

export type RepositoryDelivery = "repository" | "private";

function privateSkillsDirectory(options: {
  readonly paths: ProjectPaths;
  readonly originDirectory: string;
  readonly repositoryName: string;
}): string {
  const identity = fingerprint(`${options.originDirectory}/${options.repositoryName}`).slice(0, 16);

  return canonicalPath(path.join(options.paths.shadowcloneDirectory, "builds", `learning-${identity}`, "skills"));
}

export async function registerWorkingRepository(options: {
  readonly paths: ProjectPaths;
  readonly workingDirectory: string;
  readonly gitMetadataEnabled: boolean;
  readonly blockedOrigins: readonly string[];
  readonly managedConfigPath?: string | null;
  readonly readRemote?: GitRemoteReader;
  readonly delivery?: RepositoryDelivery;
}): Promise<EnvironmentRepository | null> {
  if (!options.gitMetadataEnabled) {
    return null;
  }

  const repository = await resolveRepository({
    cwd: options.workingDirectory,
    enabled: true,
    readRemote: options.readRemote,
  });

  if (
    repository.profileFileName === null ||
    repository.origin.directoryName.startsWith("isolated--") ||
    isOriginBlocked({ repository, patterns: options.blockedOrigins })
  ) {
    return null;
  }

  const identity = {
    directory: canonicalPath(options.workingDirectory),
    originDirectory: repository.origin.directoryName,
    repositoryName: repository.profileFileName,
  };
  const registered: EnvironmentRepository = options.delivery === "private"
    ? { ...identity, privateSkillsDirectory: privateSkillsDirectory({ paths: options.paths, ...identity }) }
    : identity;
  const lock = await acquireLocalLock(
    path.join(options.paths.shadowcloneDirectory, "environment-write.db"),
  );

  if (!lock) {
    throw new Error("Another learning update is running");
  }

  try {
    const state = await readEnvironment(options.paths);

    if (state === null || state.repositories.some((entry) => entry.directory === registered.directory)) {
      return null;
    }

    await configureSkillMaintenance({
      scope: "repository",
      paths: options.paths,
      cwd: registered.directory,
      managedConfigPath: options.managedConfigPath,
      ...(registered.privateSkillsDirectory ? { rootDirectory: registered.privateSkillsDirectory } : {}),
    });

    const filePath = environmentFile(options.paths);

    await publishEnvironmentRevision({
      paths: options.paths,
      updates: [{
        filePath,
        previous: await readLocalText(filePath),
        next: renderEnvironment({ ...state, repositories: [...state.repositories, registered] }),
      }],
    });

    return registered;
  } finally {
    lock.release();
  }
}
