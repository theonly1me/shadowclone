import type { ProjectPaths } from "../../paths";
import { readEffectiveConfig } from "../../config";

export async function assertCloudPolicy(paths: ProjectPaths): Promise<void> {
  const { policy } = await readEffectiveConfig({
    configPath: paths.configFile,
    managedConfigPath: paths.managedConfigFile,
  });

  if (
    !policy.enabled ||
    !policy.allowedEngines.includes("claude-code") ||
    policy.maxActionTier !== "act"
  ) {
    throw new Error("Managed policy does not permit a Claude cloud clone with repository writes.");
  }
}
