import path from "node:path";
import type { ProjectPaths } from "@shadowclone/core";
import type { IntegrationAgent } from "./types";

export function globalIntegrationDirectory(options: {
  readonly agent: IntegrationAgent;
  readonly paths: ProjectPaths;
}): string {
  const home = path.dirname(options.paths.shadowcloneDirectory);

  switch (options.agent) {
    case "claude-code":
      return path.join(home, ".claude");
    case "codex":
      return path.dirname(options.paths.codexSessionsDirectory);
    case "cursor":
      return path.join(home, ".cursor");
    case "antigravity":
      return path.join(home, ".gemini/config");
    case "pi":
      return options.paths.piAgentDirectory;
    case "opencode":
      return options.paths.opencodeConfigDirectory;
  }
}
