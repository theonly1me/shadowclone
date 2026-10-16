import path from "node:path";
import { stat } from "node:fs/promises";
import type { EnvironmentArtifact, EnvironmentRepository, EnvironmentState } from "./types";

function isMissingPathError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "ENOENT" || error.code === "ENOTDIR")
  );
}

export async function isMissingFolder(directory: string): Promise<boolean> {
  try {
    return !(await stat(directory)).isDirectory();
  } catch (error) {
    if (isMissingPathError(error)) {
      return true;
    }

    throw error;
  }
}

function isPublishedInside(options: {
  readonly artifact: EnvironmentArtifact;
  readonly repository: EnvironmentRepository;
}): boolean {
  return (
    options.artifact.buildId === undefined &&
    options.artifact.scope ===
      `${options.repository.originDirectory}/${options.repository.repositoryName}` &&
    options.artifact.filePath.startsWith(`${options.repository.directory}${path.sep}`)
  );
}

export async function withoutMissingRepositories(state: EnvironmentState): Promise<{
  readonly state: EnvironmentState;
  readonly removed: readonly string[];
}> {
  const missing: EnvironmentRepository[] = [];

  for (const repository of state.repositories) {
    if (await isMissingFolder(repository.directory)) {
      missing.push(repository);
    }
  }

  return {
    state: {
      ...state,
      repositories: state.repositories.filter((repository) => !missing.includes(repository)),
      artifacts: state.artifacts.filter(
        (artifact) => !missing.some((repository) => isPublishedInside({ artifact, repository })),
      ),
    },
    removed: missing.map((repository) => repository.directory),
  };
}
