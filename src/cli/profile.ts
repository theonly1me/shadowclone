import type { ShadowcloneConfig } from "../config";
import { readEnvironment } from "../environment";
import type { ProjectPaths } from "../paths";
import { compileProfile } from "../profile";
import {
  isOriginBlocked,
  resolveRepository,
  type GitRemoteReader,
} from "../signal";

export async function refreshOfflineProfile(options: {
  readonly config: ShadowcloneConfig;
  readonly paths: ProjectPaths;
  readonly cwd: string;
  readonly readRemote?: GitRemoteReader;
  readonly blockedOrigins?: readonly string[];
}): Promise<void> {
  if ((await readEnvironment(options.paths)) !== null) {
    return;
  }

  const repository = await resolveRepository({
    cwd: options.cwd,
    enabled: options.config.sources["git-metadata"],
    readRemote: options.readRemote,
  });

  if (
    isOriginBlocked({
      repository,
      patterns: options.blockedOrigins ?? [],
    })
  ) {
    return;
  }

  await compileProfile({
    input: {
      kind: "directory",
      profileDirectory: options.paths.profileDirectory,
      origin: repository.origin,
      targetRepo: repository.profileFileName,
    },
    outputPath: options.paths.compiledProfileFile,
  });
}
