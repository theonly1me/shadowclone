import type { ProjectPaths, ShadowcloneConfig } from "@shadowclone/core";
import { readEnvironment, type EnvironmentState } from "@shadowclone/environment";
import { isOriginBlocked, resolveRepository } from "@shadowclone/sessions";

export type CoverageRepository = EnvironmentState["repositories"][number];

export async function coverageRepositories(options: {
  readonly paths: ProjectPaths;
  readonly config: ShadowcloneConfig;
  readonly blockedOrigins?: readonly string[];
}): Promise<readonly CoverageRepository[]> {
  if (!options.config.sources["git-metadata"]) return [];
  const state = await readEnvironment(options.paths);
  const verified: CoverageRepository[] = [];
  for (const registered of state?.repositories ?? []) {
    const repository = await resolveRepository({ cwd: registered.directory, enabled: true });
    if (
      !isOriginBlocked({ repository, patterns: options.blockedOrigins ?? [] }) &&
      repository.origin.directoryName === registered.originDirectory &&
      repository.profileFileName === registered.repositoryName
    ) {
      verified.push(registered);
    }
  }
  return verified;
}
