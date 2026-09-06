import type { EngineRunOptions } from "../types";

export function claudeEvaluationArguments(
  run: EngineRunOptions,
): readonly string[] {
  if (!run.evaluation) {
    return [];
  }

  const noTools = run.allowedTools?.length === 0;
  const toolsArgument = noTools ? "" : "Read,Edit,Write,Glob,Grep,Bash";

  const settingsJson = JSON.stringify({
    disableAllHooks: true,
    autoMemoryEnabled: false,
    sandbox: {
      enabled: true,
      failIfUnavailable: true,
      allowUnsandboxedCommands: false,
      autoAllowBashIfSandboxed: true,
      excludedCommands: [],
      network: {
        allowedDomains: [],
        allowLocalBinding: false,
      },
    },
    permissions: {
      allow: ["Read", "Edit", "Write", "Glob", "Grep"],
      deny: ["WebFetch", "WebSearch", "Agent"],
    },
  });

  return [
    "--safe-mode",
    "--no-session-persistence",
    "--strict-mcp-config",
    "--mcp-config",
    '{"mcpServers":{}}',
    "--tools",
    toolsArgument,
    "--settings",
    settingsJson,
  ];
}
