import { resolveInstallTarget } from "./installTarget";
import {
  checkArtifactWrite,
  writeInstalledArtifact,
} from "./artifactOwnership";
import { readEffectiveConfig } from "../config";
import { canonicalPath, projectPaths } from "../paths";
import type { ProjectPaths } from "../paths";
import { compileProfile, renderAgent } from "../profile";
import {
  isOriginBlocked,
  resolveRepository,
  type GitRemoteReader,
} from "../signal";
import { renderDelegationSkill } from "./delegationSkill";
import {
  addGitExcludes,
  artifactExcludePatterns,
  artifactRelativePaths,
} from "./installArtifacts";
import {
  mergeInstallation,
  findInstallation,
  readInstallations,
  writeInstallations,
  type InstalledArtifact,
} from "./installState";

export async function installLiveClone(
  options: {
    readonly cwd?: string;
    readonly configPath?: string;
    readonly paths?: ProjectPaths;
    readonly readRemote?: GitRemoteReader;
    readonly managedConfigPath?: string | null;
    readonly autoDelegate?: boolean;
  } = {},
): Promise<void> {
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
  if (await resolveInstallTarget({ directory: canonicalPath(cwd) }) === null) {
    throw new Error("Install requires a repository root");
  }
  const repository = await resolveRepository({
    cwd,
    enabled: config.sources["git-metadata"],
    readRemote: options.readRemote,
  });
  if (isOriginBlocked({ repository, patterns: policy.blockedOrigins })) {
    throw new Error("Managed policy blocks this repository");
  }
  const compilation = await compileProfile({
    input: {
      kind: "directory",
      profileDirectory: paths.profileDirectory,
      origin: repository.origin,
      targetRepo: repository.profileFileName,
    },
    outputPath: paths.compiledProfileFile,
  });
  const state = await readInstallations(paths.installationsFile);
  const directory = canonicalPath(cwd);
  const installation = findInstallation({ state, directory });
  const artifacts: InstalledArtifact[] = options.autoDelegate
    ? ["agent", "delegation-skill"]
    : ["agent"];
  const targets = await Promise.all(
    artifacts.map((artifact) =>
      checkArtifactWrite({ directory, artifact, installation }),
    ),
  );
  const fingerprints: Partial<Record<InstalledArtifact, string>> = {};
  for (const [index, artifact] of artifacts.entries()) {
    const target = targets[index];
    if (!target) {
      throw new Error("Installation target is unavailable");
    }
    fingerprints[artifact] = await writeInstalledArtifact({
      target,
      content:
        artifact === "agent"
          ? renderAgent({ profile: compilation.markdown })
          : renderDelegationSkill(),
    });
  }
  const excludes = await addGitExcludes({
    cwd,
    patterns: artifacts.map((artifact) => artifactExcludePatterns[artifact]),
  });
  await writeInstallations({
    filePath: paths.installationsFile,
    state: mergeInstallation({
      state,
      installation: { directory, artifacts, excludes, fingerprints },
    }),
  });

  const names = artifacts.map((artifact) => artifactRelativePaths[artifact]);
  console.log(
    `Installed ${names.join(" and ")} for this repository, applying ${compilation.appliedRuleCount} profile rules.`,
  );
}
