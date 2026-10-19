import path from "node:path";
import {
  type BuildContext,
  learningScopes,
  readRedactedEnvironment,
} from "@shadowclone/environment";
import { resolveRepository, type GitRemoteReader } from "@shadowclone/sessions";

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
    return { repository: repositoryName, skills: [], leftOut: [] };
  }

  const scopes = learningScopes({ paths: context.paths, state }).filter(
    (scope) =>
      scope.repository === null ||
      (scope.repository.originDirectory === repository.origin.directoryName &&
        scope.repository.repositoryName === repository.profileFileName &&
        (context.cwd === scope.directory ||
          context.cwd.startsWith(`${scope.directory}${path.sep}`))),
  );
  const personalBuilds = new Set(
    state.builds.filter((build) => build.scope === "global").map((build) => build.id),
  );
  const scopeKeys = new Set(scopes.map((scope) => scope.key));
  const selected = state.artifacts.filter(
    (artifact) =>
      artifact.kind === "skill" &&
      (artifact.buildId ? personalBuilds.has(artifact.buildId) : scopeKeys.has(artifact.scope)),
  );
  const available = new Set<string>();

  for (const artifact of selected) {
    if (await Bun.file(artifact.filePath).exists()) {
      available.add(artifact.name);
    }
  }

  return {
    repository: repositoryName,
    skills: [...new Set(["shadowclone-work", ...available])].sort(),
    leftOut: [...new Set(selected.map((artifact) => artifact.name))]
      .filter((name) => !available.has(name) && name !== "shadowclone-work")
      .sort(),
  };
}
