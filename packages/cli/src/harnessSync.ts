import { readHarnessManifest } from "@shadowclone/environment";
import { projectPaths, type ProjectPaths } from "@shadowclone/core";
import { repositoryRoot } from "@shadowclone/harness";
import type { GitRemoteReader } from "@shadowclone/sessions";
import { promptConfirmation, type ConfirmPrompt } from "./confirm";
import { harnessInitCommand } from "./harness";

export async function harnessSyncCommand(options: {
  readonly apply: boolean | "confirm";
  readonly cwd?: string;
  readonly paths?: ProjectPaths;
  readonly managedConfigPath?: string | null;
  readonly readRemote?: GitRemoteReader;
  readonly ask?: ConfirmPrompt;
  readonly writeLine?: (line: string) => void;
}): Promise<string | null> {
  const paths = options.paths ?? projectPaths;
  const managedConfigPath =
    options.managedConfigPath === undefined
      ? paths.managedConfigFile
      : options.managedConfigPath;
  const ask = options.ask ?? promptConfirmation;
  const writeLine = options.writeLine ?? console.log;

  const root = await repositoryRoot({ cwd: options.cwd ?? process.cwd() });
  const manifest = await readHarnessManifest(root);

  if (manifest === null) {
    return null;
  }

  return harnessInitCommand({
    apply: options.apply,
    personal: null,
    skills: [],
    enforceClaude: false,
    cwd: root,
    paths,
    managedConfigPath,
    readRemote: options.readRemote,
    ask,
    writeLine,
  });
}
