import path from "node:path";
import type { BuildContext } from "../../builds/types";
import { readEffectiveConfig } from "../../config";
import { readRedactedEnvironment } from "../../environment/store";
import { learningScopes } from "../../environment/scope";
import { publishedSkills } from "../../environment/catalog";
import { readMaintenanceState } from "../../skillMaintenance/state";
import { discoverDeliverySkills } from "../../skillMaintenance/discover";
import { resolveRepository, type GitRemoteReader } from "../../signal";

export async function setupSelection(
  context: BuildContext & {
    readonly readRemote?: GitRemoteReader;
  },
) {
  const repository = await resolveRepository({
    cwd: context.cwd,
    enabled: true,
    readRemote: context.readRemote,
  });
  const state = await readRedactedEnvironment(context.paths);
  const repositoryName = repository?.id.startsWith("github.com/")
    ? repository.id.slice("github.com/".length)
    : null;

  if (state?.phase !== "active" || !repository) {
    return { repository: repositoryName, skills: [] };
  }

  const scopes = learningScopes({ paths: context.paths, state }).filter(
    (scope) =>
      scope.repository === null ||
      (scope.repository.originDirectory === repository.origin.directoryName &&
        scope.repository.repositoryName === repository.profileFileName &&
        (context.cwd === scope.directory ||
          context.cwd.startsWith(`${scope.directory}${path.sep}`))),
  );
  const { config } = await readEffectiveConfig({
    configPath: context.paths.configFile,
    managedConfigPath: context.paths.managedConfigFile,
  });
  const roots = (await readMaintenanceState(context.paths)).roots.filter(
    (root) =>
      config.sources["skill-library"] &&
      root.enabled &&
      (root.scope === "global" || scopes.some((scope) => scope.directory === root.cwd)),
  );
  const library = await discoverDeliverySkills(roots);
  const names = new Set([
    ...publishedSkills({ state, scopes: new Set(scopes.map((scope) => scope.key)) }).map(
      (skill) => skill.name,
    ),
    ...library.skills.map((skill) => skill.name),
  ]);

  return { repository: repositoryName, skills: [...names].sort() };
}
