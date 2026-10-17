import { readEffectiveConfig, projectPaths } from "@shadowclone/core";
import { isOriginBlocked, resolveRepository } from "@shadowclone/sessions";
import type { IntegrationOptions } from "./types";
import { emptyCompilation, environmentCompilation, type ContextCompilation } from "../environment/context";

type ContextOptions = IntegrationOptions & {
  readonly cwd: string;
  readonly scope?: "global" | "scoped" | "combined";
};

async function contextAccess(options: ContextOptions) {
  const paths = options.paths ?? projectPaths;
  const { config, policy } = await readEffectiveConfig({
    configPath: options.configPath ?? paths.configFile,
    managedConfigPath:
      options.managedConfigPath === undefined
        ? paths.managedConfigFile
        : options.managedConfigPath,
  });

  if (!policy.enabled) {
    return null;
  }

  const repository =
    options.scope === "global"
      ? null
      : await resolveRepository({
          cwd: options.cwd,
          enabled: config.sources["git-metadata"],
          readRemote: options.readRemote,
        });

  if (
    repository &&
    isOriginBlocked({ repository, patterns: policy.blockedOrigins })
  ) {
    return null;
  }

  return { paths, repository };
}

export async function isContextBlocked(options: ContextOptions): Promise<boolean> {
  return (await contextAccess(options)) === null;
}

export async function compileContextDetails(
  options: ContextOptions,
): Promise<ContextCompilation | null> {
  const access = await contextAccess(options);

  if (!access) {
    return null;
  }

  return (
    (await environmentCompilation({
      paths: access.paths,
      cwd: options.cwd,
      scope: options.scope,
      originDirectory: access.repository?.origin.directoryName ?? null,
      repositoryName: access.repository?.profileFileName ?? null,
    })) ?? emptyCompilation
  );
}

export async function compileContext(
  options: ContextOptions,
): Promise<string | null> {
  return (await compileContextDetails(options))?.markdown ?? null;
}
