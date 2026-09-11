import { rm } from "node:fs/promises";
import { projectPaths } from "../paths";
import type { ProjectPaths } from "../paths";
import { removeArtifacts, removeGitExcludes } from "./installArtifacts";
import { readInstallations } from "./installState";
import { resolveInstallTarget, type GitTopLevelReader } from "./installTarget";

export async function forgetAll(
  options: {
    readonly paths?: ProjectPaths;
    readonly readTopLevel?: GitTopLevelReader;
  } = {},
): Promise<void> {
  const paths = options.paths ?? projectPaths;
  const state = await readInstallations(paths.installationsFile);
  let repositories = 0;
  let skipped = 0;
  for (const installation of state.installations) {
    const root = await resolveInstallTarget({
      directory: installation.directory,
      readTopLevel: options.readTopLevel,
    });
    if (root === null) {
      skipped += 1;
      continue;
    }
    const removed = await removeArtifacts({
      directory: root,
      artifacts: installation.artifacts,
      installation,
    });
    await removeGitExcludes({
      cwd: root,
      patterns: installation.excludes,
    });
    if (removed < installation.artifacts.length) {
      skipped += 1;
    } else {
      repositories += 1;
    }
  }
  await rm(paths.shadowcloneDirectory, { recursive: true, force: true });
  console.log(
    `Removed all shadowclone data and ${repositories} repository install(s).`,
  );
  if (skipped > 0) {
    console.log(
      `Skipped ${skipped} recorded install(s) with missing, edited, unverified, or unsafe artifacts; inspect those repositories manually.`,
    );
  }
}
