import path from "node:path";
import { cloneEngine, type CloneConfig } from "../config/config";
import { prepareCodexHome } from "./codexHome";
import type { Processes } from "./processes";
import { clonePrompt, type WorkClone } from "./prompt";
import type { Workspace } from "./workspace";

export type EngineInvocation = {
  readonly arguments: readonly string[];
  readonly environment: Readonly<Record<string, string>>;
  readonly input: string;
};

export const claudeSettings = { includeCoAuthoredBy: false, attribution: { commit: "", pr: "" } };

function modelArguments(config: CloneConfig): readonly string[] {
  return config.model === undefined ? [] : ["--model", config.model];
}

export async function prepareEngine(options: {
  readonly config: CloneConfig;
  readonly clone: WorkClone;
  readonly workspace: Workspace;
  readonly processes: Processes;
  readonly environment: Readonly<Record<string, string | undefined>>;
}): Promise<EngineInvocation> {
  const { config, workspace } = options;
  const engine = cloneEngine(config);
  const input = clonePrompt({ config, engine, clone: options.clone });

  if (engine === "claude") {
    return {
      arguments: [
        "claude",
        "-p",
        "--permission-mode",
        "bypassPermissions",
        "--plugin-dir",
        path.join(workspace.skills, "plugins", "shadowclone-personal"),
        "--append-system-prompt-file",
        path.join(workspace.skills, "native.md"),
        "--settings",
        JSON.stringify(claudeSettings),
        ...modelArguments(config),
      ],
      environment: {},
      input,
    };
  }

  const home = await prepareCodexHome(options);

  return {
    arguments: [
      "codex",
      "exec",
      "-",
      "--skip-git-repo-check",
      "--sandbox",
      "danger-full-access",
      "-c",
      'approval_policy="never"',
      "-c",
      'shell_environment_policy.inherit="all"',
      ...modelArguments(config),
    ],
    environment: { CODEX_HOME: home },
    input,
  };
}
