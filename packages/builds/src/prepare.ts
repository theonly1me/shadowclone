import { readEffectiveConfig } from "@shadowclone/core";
import {
  type BuildContext,
  emptyEnvironment,
  type EnvironmentState,
  readEnvironment,
} from "@shadowclone/environment";

export async function prepareBuildEnvironment(
  context: BuildContext,
): Promise<EnvironmentState> {
  const { policy } = await readEffectiveConfig({
    configPath: context.paths.configFile,
    managedConfigPath: context.paths.managedConfigFile,
  });

  if (!policy.enabled) {
    throw new Error("Managed policy disables build changes");
  }

  const initial = await readEnvironment(context.paths);

  if (initial?.phase === "preparing") {
    throw new Error("The skills environment is not active yet. Run shadowclone init first.");
  }

  if (initial !== null) {
    return initial;
  }

  return { ...emptyEnvironment, phase: "active" };
}
