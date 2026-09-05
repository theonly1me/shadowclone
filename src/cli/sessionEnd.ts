import { realpath } from "node:fs/promises";
import path from "node:path";
import { readEffectiveConfig } from "../config";
import {
  ingestClaudeTranscript,
  openEventIndex,
} from "../index";
import { projectPaths } from "../paths";
import type { ProjectPaths } from "../paths";
import type { GitRemoteReader } from "../signal";
import {
  parseHookInput,
  readHookString,
} from "./hookInput";
import { refreshOfflineProfile } from "./profile";

async function isInsideDirectory(options: {
  readonly filePath: string;
  readonly directory: string;
}): Promise<boolean> {
  let filePath: string;
  let directory: string;
  try {
    [filePath, directory] = await Promise.all([
      realpath(options.filePath),
      realpath(options.directory),
    ]);
  } catch {
    return false;
  }
  const relative = path.relative(directory, filePath);
  return relative.length > 0 &&
    !relative.startsWith(`..${path.sep}`) &&
    relative !== ".." &&
    !path.isAbsolute(relative);
}

export async function runSessionEndHook(options: {
  readonly input: string;
  readonly configPath?: string;
  readonly paths?: ProjectPaths;
  readonly readRemote?: GitRemoteReader;
  readonly managedConfigPath?: string | null;
}): Promise<void> {
  const paths = options.paths ?? projectPaths;
  const { config, policy } = await readEffectiveConfig({
    configPath: options.configPath,
    managedConfigPath:
      options.managedConfigPath === undefined
        ? paths.managedConfigFile
        : options.managedConfigPath,
  });
  if (!policy.enabled || !config.sources["claude-code"]) {
    return;
  }
  const sourcePath = readHookString(
    parseHookInput(options.input),
    "transcript_path",
  );
  if (
    sourcePath === null ||
    !(await isInsideDirectory({
      filePath: sourcePath,
      directory: paths.claudeProjectsDirectory,
    }))
  ) {
    throw new Error("Session hook received an invalid transcript path");
  }

  const index = await openEventIndex(paths.indexDatabase);
  try {
    await ingestClaudeTranscript({ index, sourcePath });
    await refreshOfflineProfile({
      index,
      config,
      paths,
      readRemote: options.readRemote,
      blockedOrigins: policy.blockedOrigins,
    });
  } finally {
    index.close();
  }
}
