import type { EngineExecution, EngineId } from "./types";

const baseKeys = [
  "PATH",
  "HOME",
  "USER",
  "LOGNAME",
  "SHELL",
  "TERM",
  "TMPDIR",
  "LANG",
  "LC_ALL",
  "TZ",
  "SSL_CERT_FILE",
  "NODE_EXTRA_CA_CERTS",
] as const;

const engineKeys: Readonly<Record<EngineId, readonly string[]>> = {
  "claude-code": ["ANTHROPIC_API_KEY", "CLAUDE_CODE_OAUTH_TOKEN", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_BASE_URL"],
  codex: ["OPENAI_API_KEY", "OPENAI_BASE_URL"],
  "cursor-agent": ["CURSOR_API_KEY"],
  antigravity: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
  "anthropic-api": ["ANTHROPIC_API_KEY", "ANTHROPIC_BASE_URL"],
  "openai-compatible": ["OPENAI_API_KEY", "OPENAI_BASE_URL"],
};

const remoteActionKeys = ["GH_TOKEN", "GITHUB_TOKEN", "GH_HOST"] as const;

export function allowsRemoteActions(execution: EngineExecution): boolean {
  return (
    execution.purpose === "dispatch" &&
    (execution.allowedDomains ?? []).length > 0
  );
}

export function runnerEnvironment(options: {
  readonly engine: EngineId;
  readonly allowRemoteActions?: boolean;
  readonly source?: Readonly<Record<string, string | undefined>>;
}): Record<string, string> {
  const source = options.source ?? process.env;
  const keys = engineKeys[options.engine];
  const environment: Record<string, string> = {};

  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) {
      continue;
    }
    const isBase = baseKeys.some((baseKey) => baseKey === key);
    const isEngine = keys.includes(key);
    const isRemote =
      options.allowRemoteActions === true &&
      remoteActionKeys.some((remoteKey) => remoteKey === key);
    if (isBase || isEngine || isRemote) {
      environment[key] = value;
    }
  }

  return environment;
}
