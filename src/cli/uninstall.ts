import { canonicalPath, projectPaths } from "../paths";
import type { ProjectPaths } from "../paths";
import {
  artifactExcludePatterns,
  removeArtifacts,
  removeGitExcludes,
} from "./installArtifacts";
import {
  findInstallation,
  readInstallations,
  removeInstallation,
  writeInstallations,
  type InstalledArtifact,
} from "./installState";

const knownArtifacts: readonly InstalledArtifact[] = [
  "agent",
  "delegation-skill",
];

export async function uninstallLiveClone(
  options: {
    readonly cwd?: string;
    readonly paths?: ProjectPaths;
  } = {},
): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const paths = options.paths ?? projectPaths;
  const directory = canonicalPath(cwd);
  const state = await readInstallations(paths.installationsFile);
  const recorded = findInstallation({ state, directory });
  const removed = await removeArtifacts({
    directory: cwd,
    artifacts: recorded?.artifacts ?? knownArtifacts,
  });
  await removeGitExcludes({
    cwd,
    patterns:
      recorded?.excludes ??
      knownArtifacts.map((artifact) => artifactExcludePatterns[artifact]),
  });
  if (recorded !== null) {
    await writeInstallations({
      filePath: paths.installationsFile,
      state: removeInstallation({ state, directory }),
    });
  }
  console.log(`Removed ${removed} shadowclone file(s) from this repository.`);
}
