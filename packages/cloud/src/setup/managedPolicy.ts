import type { ProjectPaths } from "@shadowclone/core";
import { readEffectiveConfig } from "@shadowclone/core";
import type { Engine } from "../types";

const policyEngines = { claude: "claude-code", codex: "codex", cursor: "cursor-agent" } as const;
const engineNames = { claude: "Claude", codex: "Codex", cursor: "Cursor" } as const;

export async function assertCloudPolicy(options: {
  readonly paths: ProjectPaths;
  readonly engine: Engine;
}): Promise<void> {
  const { policy } = await readEffectiveConfig({
    configPath: options.paths.configFile,
    managedConfigPath: options.paths.managedConfigFile,
  });
  if (!policy.enabled || !policy.allowedEngines.includes(policyEngines[options.engine]) || policy.maxActionTier !== "act") {
    throw new Error(`Managed policy does not permit a ${engineNames[options.engine]} cloud bot with repository writes.`);
  }
}
