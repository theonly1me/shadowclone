import { resolveInstallTarget } from "./installTarget";
import { canonicalPath, projectPaths } from "../paths";
import type { ProjectPaths } from "../paths";
import {
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
  if (await resolveInstallTarget({ directory }) === null) {
    throw new Error("Uninstall requires a repository root");
  }
  const state = await readInstallations(paths.installationsFile);
  const recorded = findInstallation({ state, directory });
  const removed = await removeArtifacts({
    directory: cwd,
    artifacts: recorded?.artifacts ?? knownArtifacts,
    installation: recorded,
  });
  await removeGitExcludes({
    cwd,
    patterns:
      recorded?.excludes ?? [],
  });
  if (recorded !== null && removed === recorded.artifacts.length) {
    await writeInstallations({
      filePath: paths.installationsFile,
      state: removeInstallation({ state, directory }),
    });
  }
  console.log(`Removed ${removed} shadowclone file(s) from this repository.`);
}
