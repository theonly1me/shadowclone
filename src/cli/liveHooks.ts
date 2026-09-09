import { readEffectiveConfig } from "../config";
import { projectPaths } from "../paths";
import type { ProjectPaths } from "../paths";
import { compileProfile } from "../profile";
import {
  isOriginBlocked,
  resolveRepository,
  type GitRemoteReader,
} from "../signal";
import {
  parseHookInput,
  readHookString,
} from "./hookInput";

type LiveHookOptions = {
  readonly input: string;
  readonly configPath?: string;
  readonly paths?: ProjectPaths;
  readonly readRemote?: GitRemoteReader;
  readonly managedConfigPath?: string | null;
};

export type SessionStartContext = {
  readonly hookSpecificOutput: {
    readonly hookEventName: "SessionStart";
    readonly additionalContext: string;
  };
};

async function activeProfile(options: LiveHookOptions): Promise<{
  readonly profile: string;
} | null> {
  const paths = options.paths ?? projectPaths;
  const { config, policy } = await readEffectiveConfig({
    configPath: options.configPath,
    managedConfigPath:
      options.managedConfigPath === undefined
        ? paths.managedConfigFile
        : options.managedConfigPath,
  });
  if (!policy.enabled) {
    return null;
  }
  const input = parseHookInput(options.input);
  const cwd = readHookString(input, "cwd") ?? process.cwd();
  const repository = await resolveRepository({
    cwd,
    enabled: config.sources["git-metadata"],
    readRemote: options.readRemote,
  });
  if (isOriginBlocked({ repository, patterns: policy.blockedOrigins })) {
    return null;
  }
  return {
    profile: (
      await compileProfile({
        input: {
          kind: "directory",
          profileDirectory: paths.profileDirectory,
          origin: repository.origin,
          targetRepo: repository.profileFileName,
        },
      })
    ).markdown,
  };
}

export async function getSessionStartContext(
  options: LiveHookOptions,
): Promise<SessionStartContext | null> {
  const active = await activeProfile(options);
  return active === null
    ? null
    : {
        hookSpecificOutput: {
          hookEventName: "SessionStart",
          additionalContext: active.profile,
        },
      };
}

export async function runSessionStartHook(
  options: LiveHookOptions,
): Promise<void> {
  const response = await getSessionStartContext(options);
  if (response !== null) {
    await Bun.stdout.write(`${JSON.stringify(response)}\n`);
  }
}
