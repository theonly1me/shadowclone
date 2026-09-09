import { mkdir } from "node:fs/promises";
import path from "node:path";
import { readEffectiveConfig } from "../config";
import { canonicalPath, projectPaths } from "../paths";
import type { ProjectPaths } from "../paths";
import { compileProfile, writeAgent } from "../profile";
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
  readInstallations,
  writeInstallations,
  type InstalledArtifact,
} from "./installState";

async function writeDelegationSkill(cwd: string): Promise<void> {
  const skillPath = path.join(cwd, artifactRelativePaths["delegation-skill"]);
  await mkdir(path.dirname(skillPath), { recursive: true });
  await Bun.write(skillPath, renderDelegationSkill());
}

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
  await writeAgent({ targetDirectory: cwd, profile: compilation.markdown });

  const artifacts: InstalledArtifact[] = ["agent"];
  if (options.autoDelegate === true) {
    await writeDelegationSkill(cwd);
    artifacts.push("delegation-skill");
  }
  const excludes = await addGitExcludes({
    cwd,
    patterns: artifacts.map((artifact) => artifactExcludePatterns[artifact]),
  });
  const state = await readInstallations(paths.installationsFile);
  await writeInstallations({
    filePath: paths.installationsFile,
    state: mergeInstallation({
      state,
      installation: { directory: canonicalPath(cwd), artifacts, excludes },
    }),
  });

  const names = artifacts.map((artifact) => artifactRelativePaths[artifact]);
  console.log(
    `Installed ${names.join(" and ")} for this repository, applying ${compilation.appliedRuleCount} profile rules.`,
  );
}
