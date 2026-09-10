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

const engineKeyPrefixes: Readonly<Record<EngineId, readonly string[]>> = {
  "claude-code": ["ANTHROPIC_", "CLAUDE_CODE_"],
  codex: ["OPENAI_", "CODEX_"],
  "cursor-agent": ["CURSOR_"],
  antigravity: ["GEMINI_", "GOOGLE_"],
  "anthropic-api": ["ANTHROPIC_"],
  "openai-compatible": ["OPENAI_"],
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
  const prefixes = engineKeyPrefixes[options.engine];
  const environment: Record<string, string> = {};

  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) {
      continue;
    }
    const isBase = baseKeys.some((baseKey) => baseKey === key);
    const isEngine = prefixes.some((prefix) => key.startsWith(prefix));
    const isRemote =
      options.allowRemoteActions === true &&
      remoteActionKeys.some((remoteKey) => remoteKey === key);
    if (isBase || isEngine || isRemote) {
      environment[key] = value;
    }
  }

  return environment;
}
