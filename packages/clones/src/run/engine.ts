import path from "node:path";
import { cloneEngine, type CloneConfig } from "../config/config";
import { questionsFileVariable } from "./ask/questions";
import { prepareCodexHome } from "./codexHome";
import type { CodexThread } from "./drive/codex";
import type { Processes } from "./processes";
import { clonePrompt, type WorkClone } from "./prompt";
import type { Workspace } from "./workspace";

export type EngineLaunch = {
  readonly arguments: readonly string[];
  readonly environment: Readonly<Record<string, string>>;
  readonly prompt: string;
  readonly codex: CodexThread | null;
};

export const claudeSettings = { includeCoAuthoredBy: false, attribution: { commit: "", pr: "" } };

export const askServerCommand = ["shadowclone", "clone", "ask-server"] as const;

function modelArguments(config: CloneConfig): readonly string[] {
  return config.model === undefined ? [] : ["--model", config.model];
}

export function claudeMcpConfig(questionsFile: string): string {
  const [command, ...args] = askServerCommand;

  return JSON.stringify({
    mcpServers: {
      shadowclone: {
        type: "stdio",
        command,
        args,
        env: { [questionsFileVariable]: questionsFile },
      },
    },
  });
}

export async function prepareEngine(options: {
  readonly config: CloneConfig;
  readonly clone: WorkClone;
  readonly workspace: Workspace;
  readonly processes: Processes;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly questionsFile: string;
}): Promise<EngineLaunch> {
  const { config, workspace } = options;
  const engine = cloneEngine(config);
  const prompt = clonePrompt({ config, engine, clone: options.clone });

  if (engine === "claude") {
    return {
      arguments: [
        "claude",
        "-p",
        "--input-format",
        "stream-json",
        "--output-format",
        "stream-json",
        "--verbose",
        "--permission-mode",
        "bypassPermissions",
        "--plugin-dir",
        path.join(workspace.skills, "plugins", "shadowclone-personal"),
        "--append-system-prompt-file",
        path.join(workspace.skills, "native.md"),
        "--settings",
        JSON.stringify(claudeSettings),
        "--mcp-config",
        claudeMcpConfig(options.questionsFile),
        ...modelArguments(config),
      ],
      environment: {},
      prompt,
      codex: null,
    };
  }

  const home = await prepareCodexHome({ ...options, askQuestionsFile: options.questionsFile });

  return {
    arguments: ["codex", "app-server"],
    environment: { CODEX_HOME: home },
    prompt,
    codex: {
      cwd: workspace.repository,
      ...(config.model === undefined ? {} : { model: config.model }),
    },
  };
}
