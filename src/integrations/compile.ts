import { readEffectiveConfig } from "../config";
import { projectPaths } from "../paths";
import { compileProfile } from "../profile";
import { isOriginBlocked, resolveRepository } from "../signal";
import type { IntegrationOptions } from "./types";

export async function compileContext(options: IntegrationOptions & {
  readonly cwd: string;
  readonly scope?: "global" | "scoped" | "combined";
}): Promise<string | null> {
  const paths = options.paths ?? projectPaths;
  const { config, policy } = await readEffectiveConfig({
    configPath: options.configPath ?? paths.configFile,
    managedConfigPath: options.managedConfigPath === undefined ? paths.managedConfigFile : options.managedConfigPath,
  });
  if (!policy.enabled) return null;
  const repository = options.scope === "global" ? null : await resolveRepository({
    cwd: options.cwd,
    enabled: config.sources["git-metadata"],
    readRemote: options.readRemote,
  });
  if (repository && isOriginBlocked({ repository, patterns: policy.blockedOrigins })) return null;
  return (await compileProfile({
    input: {
      kind: "directory",
      profileDirectory: paths.profileDirectory,
      origin: repository?.origin ?? null,
      targetRepo: repository?.profileFileName ?? null,
      scope: options.scope,
    },
  })).markdown;
}
