import path from "node:path";
import type { FileUpdate } from "../changes";
import { readLocalText, fingerprint } from "../localFiles";
import type { ProjectPaths } from "../paths";
import { prepareIntegrationFiles } from "../integrations/files";
import { readIntegrations } from "../integrations/state";
import { learningScopes } from "./scope";
import { renderSkillRouting } from "./context";
import type { EnvironmentState } from "./types";
import { readEffectiveConfig } from "../config";
import {
  isOriginBlocked,
  resolveRepository,
  type GitRemoteReader,
} from "../signal";

export async function nativePublication(options: {
  readonly paths: ProjectPaths;
  readonly state: EnvironmentState;
  readonly readRemote?: GitRemoteReader;
}): Promise<{
  readonly state: EnvironmentState;
  readonly updates: readonly FileUpdate[];
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
        "A registered repository identity changed or is blocked; native files were preserved",
      );
    }
  }

  const integrations = await readIntegrations(options.paths);
  const updatedIntegrations = [];
  const updates: FileUpdate[] = [];

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
      environment: true,
    });

    updates.push(
      ...changes.map(({ filePath, previous, next }) => ({
        filePath,
        previous,
        next,
      })),
    );
    updatedIntegrations.push({
      ...integration,
      files: changes.map(({ record }) => record),
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
    updates: updates.filter(
      ({ previous, next }) =>
        fingerprint(previous ?? "") !== fingerprint(next ?? ""),
    ),
  };
}
