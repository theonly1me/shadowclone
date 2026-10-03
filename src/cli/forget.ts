import { readdir, rm } from "node:fs/promises";
import { projectPaths } from "../paths";
import type { ProjectPaths } from "../paths";
import { removeArtifacts, removeGitExcludes } from "./installArtifacts";
import { readInstallations } from "./installState";
import { readIntegrations, uninstallIntegration } from "../integrations";
import { removeSkillMaintenance } from "../skillMaintenance";
import { removeLearningEnvironment } from "../environment/cleanup";

export async function forgetAll(
  options: { readonly paths?: ProjectPaths } = {},
): Promise<void> {
  const paths = options.paths ?? projectPaths;

  if ((await readdir(paths.worktreesDirectory).catch(() => [])).length > 0) {
    throw new Error(
      `Worktrees from earlier delegated tasks remain in ${paths.worktreesDirectory}. Move or remove them yourself before forgetting Shadowclone data`,
    );
  }

  await removeLearningEnvironment(paths);
  await removeSkillMaintenance(paths);

  for (const integration of await readIntegrations(paths)) {
    await uninstallIntegration({ integration, paths });
  }

  const state = await readInstallations(paths.installationsFile);
  let repositories = 0;

  for (const installation of state.installations) {
    await removeArtifacts({
      directory: installation.directory,
      artifacts: installation.artifacts,
      installation,
    });
    await removeGitExcludes({
      cwd: installation.directory,
      patterns: installation.excludes,
    });
    repositories += 1;
  }

  await rm(paths.shadowcloneDirectory, { recursive: true, force: true });
  console.log(
    `Removed all shadowclone data and ${repositories} repository install(s).`,
  );
}
