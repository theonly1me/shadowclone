import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { stringify } from "smol-toml";
import type { CloneConfig } from "../config/config";
import { questionsFileVariable } from "./ask/questions";
import { mustRun, type Processes } from "./processes";
import type { Workspace } from "./workspace";

export const codexLoginHomeVariable = "SHADOWCLONE_CODEX_LOGIN_HOME";

function codexSettings(options: {
  readonly config: CloneConfig;
  readonly environment: Readonly<Record<string, string | undefined>>;
}): Record<string, unknown> {
  const { config } = options;
  const baseUrl = config.baseUrl ?? "";

  if (config.provider === "chatgpt-subscription") {
    return { cli_auth_credentials_store: "file" };
  }

  if (config.provider === "openai-compatible") {
    return { openai_base_url: baseUrl };
  }

  if (config.provider === "ollama") {
    const keyed = (options.environment.OLLAMA_API_KEY ?? "") !== "";

    return {
      model_provider: "session",
      model_providers: {
        session: {
          name: "Ollama",
          base_url: baseUrl,
          wire_api: "responses",
          ...(keyed ? { env_key: "OLLAMA_API_KEY" } : {}),
        },
      },
    };
  }

  if (config.provider === "foundry") {
    return {
      model_provider: "session",
      model_providers: {
        session: {
          name: "Azure OpenAI",
          base_url: baseUrl,
          env_key: "AZURE_OPENAI_API_KEY",
          wire_api: "responses",
        },
      },
    };
  }

  return {};
}

function askSettings(questionsFile: string | undefined): Record<string, unknown> {
  return questionsFile === undefined
    ? {}
    : {
        shell_environment_policy: { inherit: "all" },
        mcp_servers: {
          shadowclone: {
            command: "shadowclone",
            args: ["clone", "ask-server"],
            env: { [questionsFileVariable]: questionsFile },
          },
        },
      };
}

const loginSecrets: Partial<Record<CloneConfig["provider"], string>> = {
  openai: "OPENAI_API_KEY",
  "openai-compatible": "OPENAI_COMPATIBLE_API_KEY",
};

export async function prepareCodexHome(options: {
  readonly config: CloneConfig;
  readonly workspace: Workspace;
  readonly processes: Processes;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly askQuestionsFile?: string;
}): Promise<string> {
  const { config, workspace, processes } = options;
  const loginHome = options.environment[codexLoginHomeVariable];

  if (config.provider === "chatgpt-subscription" && (loginHome === undefined || loginHome === "")) {
    throw new Error("The ChatGPT login needs its volume. Run shadowclone clone login on the host.");
  }

  const home =
    config.provider === "chatgpt-subscription" && loginHome !== undefined
      ? loginHome
      : path.join(workspace.root, "codex-home");
  const skills = path.join(home, "skills");

  await mkdir(home, { recursive: true, mode: 0o700 });
  await rm(skills, { recursive: true, force: true });
  await cp(path.join(workspace.skills, "plugins", "shadowclone-personal", "skills"), skills, {
    recursive: true,
  });
  await cp(path.join(workspace.skills, "native.md"), path.join(home, "AGENTS.md"));
  const settings = { ...codexSettings(options), ...askSettings(options.askQuestionsFile) };

  await writeFile(path.join(home, "config.toml"), stringify(settings), {
    mode: 0o600,
  });

  const secret = loginSecrets[config.provider];

  if (secret !== undefined) {
    await mustRun({
      processes,
      arguments: ["sh", "-c", 'printenv "$SHADOWCLONE_LOGIN_SECRET" | codex login --with-api-key'],
      cwd: workspace.root,
      environment: { CODEX_HOME: home, SHADOWCLONE_LOGIN_SECRET: secret },
    });
  }

  return home;
}
