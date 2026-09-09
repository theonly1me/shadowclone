import { isIsolatedExecution } from "./execution";
import type { EngineRunOptions } from "./types";

export function claudeIsolationArguments(
  run: EngineRunOptions,
): readonly string[] {
  if (!isIsolatedExecution(run)) {
    return [];
  }

  const noTools =
    run.execution.purpose === "learning" || run.allowedTools?.length === 0;
  const tools = noTools ? "" : "Read,Edit,Write,Glob,Grep,Bash";
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
      allow: noTools ? [] : ["Read", "Edit", "Write", "Glob", "Grep"],
      deny: ["WebFetch", "WebSearch", "Agent", "mcp__*"],
    },
  });

  return [
    ...(run.execution.purpose === "learning" ? ["--restricted"] : []),
    "--safe-mode",
    "--no-session-persistence",
    "--strict-mcp-config",
    "--mcp-config",
    '{"mcpServers":{}}',
    "--tools",
    tools,
    "--disallowedTools",
    "mcp__*",
    "--settings",
    settingsJson,
  ];
}
