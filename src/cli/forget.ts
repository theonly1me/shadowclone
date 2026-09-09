import { rm } from "node:fs/promises";
import { projectPaths } from "../paths";
import type { ProjectPaths } from "../paths";
import { removeArtifacts, removeGitExcludes } from "./installArtifacts";
import { readInstallations } from "./installState";

export async function forgetAll(
  options: { readonly paths?: ProjectPaths } = {},
): Promise<void> {
  const paths = options.paths ?? projectPaths;
  const state = await readInstallations(paths.installationsFile);
  let repositories = 0;
  for (const installation of state.installations) {
    await removeArtifacts({
      directory: installation.directory,
      artifacts: installation.artifacts,
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
