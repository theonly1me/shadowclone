import path from "node:path";
import { readEffectiveConfig } from "../config";
import { projectPaths } from "../paths";
import type { ProjectPaths } from "../paths";
import {
  buildCompiledProfile,
  isToolBlocked,
} from "../profile";
import {
  isOriginBlocked,
  resolveCwdOrigin,
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

export type PreToolUseDecision = {
  readonly hookSpecificOutput: {
    readonly hookEventName: "PreToolUse";
    readonly permissionDecision: "deny";
    readonly permissionDecisionReason: string;
  };
};

export type SessionStartContext = {
  readonly hookSpecificOutput: {
    readonly hookEventName: "SessionStart";
    readonly additionalContext: string;
  };
};

async function activeProfile(options: LiveHookOptions): Promise<{
  readonly profile: string;
  readonly toolName: string | null;
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
  const origin = await resolveCwdOrigin({
    cwd,
    enabled: config.sources["git-metadata"],
    readRemote: options.readRemote,
  });
  if (isOriginBlocked({ origin, cwd, patterns: policy.blockedOrigins })) {
    return null;
  }
  return {
    profile: await buildCompiledProfile({
      profileDirectory: paths.profileDirectory,
      origin,
      targetRepo: path.basename(cwd),
    }),
    toolName: readHookString(input, "tool_name"),
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

export async function getPreToolUseDecision(
  options: LiveHookOptions,
): Promise<PreToolUseDecision | null> {
  const active = await activeProfile(options);
  if (
    active === null ||
    active.toolName === null ||
    !isToolBlocked({
      profile: active.profile,
      toolName: active.toolName,
    })
  ) {
    return null;
  }
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason:
        `${active.toolName} is blocked by the active shadowclone boundaries.`,
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

export async function runPreToolUseHook(
  options: LiveHookOptions,
): Promise<void> {
  const response = await getPreToolUseDecision(options);
  if (response !== null) {
    await Bun.stdout.write(`${JSON.stringify(response)}\n`);
  }
}
