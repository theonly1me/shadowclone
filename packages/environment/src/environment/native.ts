import path from "node:path";
import type { FileUpdate } from "@shadowclone/changes";
import {
  readLocalText,
  fingerprint,
  UnsafeDestinationError,
  readEffectiveConfig,
} from "@shadowclone/core";
import type { ProjectPaths } from "@shadowclone/core";
import { prepareIntegrationFiles, savedRecords } from "../integrations/files";
import { isPreservedFileError } from "../integrations/preserved";
import { readIntegrations } from "../integrations/state";
import { sharedIntegrationUpdates } from "../integrations/sharedUpdates";
import { learningScopes } from "./scope";
import { isMissingFolder } from "./missingRepositories";
import { renderSkillRouting } from "./context";
import type { EnvironmentState } from "./types";
import {
  isOriginBlocked,
  resolveRepository,
  type GitRemoteReader,
} from "@shadowclone/sessions";

export type SkippedRouting = { readonly agent: string; readonly path: string; readonly target: string | null };

export async function nativePublication(options: {
  readonly paths: ProjectPaths;
  readonly state: EnvironmentState;
  readonly readRemote?: GitRemoteReader;
  readonly skipLinkedFiles?: boolean;
}): Promise<{
  readonly state: EnvironmentState;
  readonly updates: readonly FileUpdate[];
  readonly skipped: readonly SkippedRouting[];
}> {
  const scopes = learningScopes(options);
  const { config, policy } = await readEffectiveConfig({
    configPath: options.paths.configFile,
    managedConfigPath: options.paths.managedConfigFile,
  });

  if (!policy.enabled) {
    throw new Error("Managed policy blocks native publication");
  }

  for (const scope of scopes) {
    if (scope.repository === null) {
      continue;
    }

    if (await isMissingFolder(scope.directory)) {
      throw new Error(
        `The registered repository folder ${scope.directory} no longer exists. Run shadowclone sync to remove it.`,
      );
    }

    const repository = await resolveRepository({
      cwd: scope.directory,
      enabled: config.sources["git-metadata"],
      readRemote: options.readRemote,
    });

    if (
      isOriginBlocked({ repository, patterns: policy.blockedOrigins }) ||
      repository.origin.directoryName !== scope.repository.originDirectory ||
      repository.profileFileName !== scope.repository.repositoryName
    ) {
      throw new Error(
        `The registered repository at ${scope.directory} changed its Git origin or is blocked. shadowclone kept the native files.`,
      );
    }
  }

  const integrations = await readIntegrations(options.paths);
  const updatedIntegrations = [];
  const updates: FileUpdate[] = [];
  const skipped: SkippedRouting[] = [];

  for (const integration of integrations) {
    const applicable = scopes.filter(
      (scope) =>
        scope.repository === null ||
        (integration.scope === "repository" &&
          integration.directory === scope.directory),
    );

    const changes = await prepareIntegrationFiles({
      integration,
      profile: renderSkillRouting({ state: options.state, scopes: applicable }),
    }).catch((error: unknown) => {
      if (isPreservedFileError(error)) {
        skipped.push({ agent: integration.agent, path: integration.directory, target: null });

        return null;
      }

      if (!options.skipLinkedFiles || !(error instanceof UnsafeDestinationError)) throw error;

      skipped.push({ agent: integration.agent, path: error.path, target: error.target });

      return null;
    });

    if (changes === null) {
      updatedIntegrations.push(integration);
      continue;
    }

    updates.push(
      ...changes.map(({ filePath, previous, next }) => ({
        filePath,
        previous,
        next,
      })),
    );
    updatedIntegrations.push({
      ...integration,
      files: savedRecords(changes),
    });
  }

  const filePath = path.join(options.paths.shadowcloneDirectory, "integrations.json");
  const previous = await readLocalText(filePath);

  if (integrations.length > 0) {
    updates.push({
      filePath,
      previous,
      next: `${JSON.stringify({ version: 1, integrations: updatedIntegrations }, null, 2)}\n`,
    });
  }

  return {
    state: options.state,
    skipped,
    updates: sharedIntegrationUpdates(updates).filter(
      ({ previous, next }) =>
        fingerprint(previous ?? "") !== fingerprint(next ?? ""),
    ),
  };
}
