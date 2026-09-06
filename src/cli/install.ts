import { mkdir } from "node:fs/promises";
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

async function excludeGitFiles(cwd: string): Promise<void> {
  const child = Bun.spawn({
    cmd: ["git", "-C", cwd, "rev-parse", "--git-path", "info/exclude"],
    stdout: "pipe",
    stderr: "ignore",
  });
  if ((await child.exited) !== 0) {
    return;
  }
  const relativeExclude = (await new Response(child.stdout).text()).trim();
  if (relativeExclude.length === 0) {
    return;
  }
  const excludePath = path.isAbsolute(relativeExclude)
    ? relativeExclude
    : path.resolve(cwd, relativeExclude);
  const excludeFile = Bun.file(excludePath);
  const existing = (await excludeFile.exists()) ? await excludeFile.text() : "";
  const patterns = [
    ".claude/agents/shadowclone.md",
    ".claude/skills/shadowclone/",
  ];
  const missing = patterns.filter((pattern) => !existing.includes(pattern));
  if (missing.length === 0) {
    return;
  }
  await mkdir(path.dirname(excludePath), { recursive: true });
  const prefix =
    existing.length > 0 && !existing.endsWith("\n") ? `${existing}\n` : existing;
  await Bun.write(excludePath, `${prefix}${missing.join("\n")}\n`);
}

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

  const skillsDirectory = path.join(cwd, ".claude", "skills", "shadowclone");
  await mkdir(skillsDirectory, { recursive: true });
  const skillContent = [
    "---",
    "name: shadowclone",
    "description: How to delegate tasks to the shadowclone subagent",
    "---",
    "",
    'When the user asks you to perform a task using shadowclone, or if you believe the task is complex enough to delegate, use the `Agent` tool with `subagent_type: "shadowclone"` to spawn a clone.',
    "Pass the user's request verbatim in the tool prompt.",
  ].join("\n");
  await Bun.write(path.join(skillsDirectory, "SKILL.md"), skillContent);
  await excludeGitFiles(cwd);
  console.log("Installed .claude/agents/shadowclone.md for this repository.");
}
