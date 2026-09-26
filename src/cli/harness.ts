import { readConfig, readManagedPolicy, setSourceEnabled, writeConfig } from "../config";
import { applyHarness, planHarness, readHarnessManifest, renderHarnessPreview } from "../harness";
import { canonicalPath, projectPaths, type ProjectPaths } from "../paths";
import type { GitRemoteReader } from "../signal";
import { promptConfirmation, type ConfirmPrompt } from "./confirm";

export type HarnessInitOptions = {
  readonly apply: boolean;
  readonly personal: boolean | null;
  readonly skills: readonly string[];
  readonly enforceClaude: boolean;
};

export function parseHarnessInit(arguments_: readonly string[]): HarnessInitOptions | null {
  let apply = false;
  let personal: boolean | null = null;
  let enforceClaude = false;
  const skills: string[] = [];
  for (let position = 0; position < arguments_.length; position += 1) {
    const argument = arguments_[position];
    if (argument === "--apply") apply = true;
    else if (argument === "--personal" && personal === null) personal = true;
    else if (argument === "--no-personal" && personal === null) personal = false;
    else if (argument === "--skill" && arguments_[position + 1]) skills.push(arguments_[++position] ?? "");
    else if (argument === "--enforce-claude") enforceClaude = true;
    else return null;
  }
  return { apply, personal, skills, enforceClaude };
}

const manifestQuestion = "Harness init reads this repository's package.json scripts and dependency names, lockfile names, pyproject.toml, requirements.txt, Makefile targets, CI workflow files, and top-level entry names. Allow reading them?";
const personalQuestion = "Include your personal global preferences in this repository's AGENTS.md? They will be committed and visible to anyone with repository access.";

export async function harnessInitCommand(options: HarnessInitOptions & {
  readonly cwd?: string;
  readonly paths?: ProjectPaths;
  readonly managedConfigPath?: string | null;
  readonly readRemote?: GitRemoteReader;
  readonly ask?: ConfirmPrompt;
  readonly writeLine?: (line: string) => void;
  readonly applyCommand?: string;
}): Promise<string | null> {
  const paths = options.paths ?? projectPaths;
  const ask = options.ask ?? promptConfirmation;
  const writeLine = options.writeLine ?? console.log;
  const managedConfigPath = options.managedConfigPath === undefined ? paths.managedConfigFile : options.managedConfigPath;
  const policy = await readManagedPolicy(managedConfigPath);
  if (!policy.enabled) throw new Error("Shadowclone is disabled by managed policy");
  if (!policy.allowedSources.includes("repository-manifests")) throw new Error("Managed policy blocks reading repository manifests");
  let config = await readConfig({ configPath: paths.configFile });
  if (!config.sources["repository-manifests"]) {
    if (!(await ask(manifestQuestion))) {
      writeLine("Nothing was read or written.");
      return null;
    }
    config = setSourceEnabled({ config, source: "repository-manifests", enabled: true });
    await writeConfig({ config, configPath: paths.configFile });
  }
  if (options.skills.length > 0 && !(config.sources["skill-library"] && policy.allowedSources.includes("skill-library"))) {
    throw new Error("Copying personal skills needs the skill-library source; run `shadowclone skills configure` first");
  }
  const root = canonicalPath(options.cwd ?? process.cwd());
  const personal = options.personal ?? (await readHarnessManifest(root))?.personal ?? await ask(personalQuestion);
  const plan = await planHarness({ root, personal, skillNames: options.skills, enforceClaude: options.enforceClaude, paths, managedConfigPath, readRemote: options.readRemote });
  const revision = options.apply ? await applyHarness({ paths, plan }) : undefined;
  writeLine(renderHarnessPreview({ plan, revision, applyCommand: options.applyCommand }).trimEnd());
  return revision ?? null;
}
