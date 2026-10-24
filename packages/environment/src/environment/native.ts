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
import { PreservedFileError, type PreservedReason } from "../integrations/preserved";
import { readIntegrations } from "../integrations/state";
import { sharedIntegrationUpdates } from "../integrations/sharedUpdates";
import { learningScopes } from "./scope";
import { isMissingFolder } from "./missingRepositories";
import { renderSkillRouting } from "./context";
import { publishTaskCatalogs } from "./taskCatalogs";
import { type MissingBuildSkill, withoutMissingBuildSkills } from "./builds/missingSkills";
import type { EnvironmentState } from "./types";
import { isOriginBlocked, resolveRepository, type GitRemoteReader } from "@shadowclone/sessions";

export type SkippedRouting =
  | {
      readonly kind: "catalog";
      readonly path: string;
      readonly reason: "edited" | "untracked";
    }
  | {
      readonly kind: "link";
      readonly agent: string;
      readonly path: string;
      readonly target: string | null;
    }
  | {
      readonly kind: "preserved";
      readonly agent: string;
      readonly path: string;
      readonly reason: PreservedReason;
    };

export type ReplacedRouting = { readonly agent: string | null; readonly path: string };

export async function nativePublication(options: {
  readonly paths: ProjectPaths;
  readonly state: EnvironmentState;
  readonly readRemote?: GitRemoteReader;
  readonly skipLinkedFiles?: boolean;
  readonly replaceEdited?: boolean;
}): Promise<{
  readonly state: EnvironmentState;
  readonly updates: readonly FileUpdate[];
  readonly skipped: readonly SkippedRouting[];
  readonly replaced: readonly ReplacedRouting[];
  readonly missing: readonly MissingBuildSkill[];
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

  const catalogs = await publishTaskCatalogs({
    state: options.state,
    scopes,
    replaceEdited: options.replaceEdited,
  });
  const routed = await withoutMissingBuildSkills(catalogs.state);
  const integrations = await readIntegrations(options.paths);
  const updatedIntegrations = [];
  const updates: FileUpdate[] = [...catalogs.updates];
  const skipped: SkippedRouting[] = catalogs.skipped.map((entry) => ({
    kind: "catalog",
    ...entry,
  }));
  const replaced: ReplacedRouting[] = catalogs.replaced.map((filePath) => ({
    agent: null,
    path: filePath,
  }));

  for (const integration of integrations) {
    const applicable = scopes.filter(
      (scope) =>
        scope.repository === null ||
        (integration.scope === "repository" && integration.directory === scope.directory),
    );

    const changes = await prepareIntegrationFiles({
      integration,
      profile: renderSkillRouting({ state: routed.state, scopes: applicable }),
      replaceEdited: options.replaceEdited,
    }).catch((error: unknown) => {
      if (error instanceof PreservedFileError) {
        skipped.push({
          kind: "preserved",
          agent: integration.agent,
          path: error.filePath ?? integration.directory,
          reason: error.reason,
        });

        return null;
      }

      if (!options.skipLinkedFiles || !(error instanceof UnsafeDestinationError)) throw error;

      skipped.push({
        kind: "link",
        agent: integration.agent,
        path: error.path,
        target: error.target,
      });

      return null;
    });

    if (changes === null) {
      updatedIntegrations.push(integration);
      continue;
    }

    replaced.push(
      ...changes
        .filter((change) => change.replacedEdit)
        .map((change) => ({ agent: integration.agent, path: change.filePath })),
    );
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
    state: catalogs.state,
    skipped,
    replaced,
    missing: routed.missing,
    updates: sharedIntegrationUpdates(updates).filter(
      ({ previous, next }) => fingerprint(previous ?? "") !== fingerprint(next ?? ""),
    ),
  };
}
