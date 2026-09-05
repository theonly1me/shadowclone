import path from "node:path";
import { readEffectiveConfig } from "../config";
import { projectPaths } from "../paths";
import type { ProjectPaths } from "../paths";
import {
  compileProfile,
  writeAgent,
} from "../profile";
import {
  isOriginBlocked,
  resolveCwdOrigin,
  type GitRemoteReader,
} from "../signal";

export async function installLiveClone(options: {
  readonly cwd?: string;
  readonly configPath?: string;
  readonly paths?: ProjectPaths;
  readonly readRemote?: GitRemoteReader;
  readonly managedConfigPath?: string | null;
} = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const paths = options.paths ?? projectPaths;
  const { config, policy } = await readEffectiveConfig({
    configPath: options.configPath,
    managedConfigPath:
      options.managedConfigPath === undefined
        ? paths.managedConfigFile
        : options.managedConfigPath,
  });
  if (!policy.enabled) {
    throw new Error("Shadowclone is disabled by managed policy");
  }
  const origin = await resolveCwdOrigin({
    cwd,
    enabled: config.sources["git-metadata"],
    readRemote: options.readRemote,
  });
  if (isOriginBlocked({ origin, cwd, patterns: policy.blockedOrigins })) {
    throw new Error("Managed policy blocks this repository");
  }
  const profile = await compileProfile({
    profileDirectory: paths.profileDirectory,
    outputPath: paths.compiledProfileFile,
    origin,
    targetRepo: path.basename(cwd),
  });
  await writeAgent({ targetDirectory: cwd, profile });
  console.log("Installed .claude/agents/shadowclone.md for this repository.");
}
